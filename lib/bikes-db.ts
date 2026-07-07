// Client-side data layer for the bicycle fleet backed by Supabase.
// Only used when a real Supabase session exists — demo mode stays in-memory.
// RLS: any signed-in user can read; only admins can write directly.
// Borrow/return flows go through security-definer RPCs (see rides-db.ts).

import { createClient } from "@/lib/supabase/client"
import type { Bike, ServiceRecord } from "@/lib/types"

interface ServiceRecordRow {
  id: string
  type: string
  notes: string
  created_at: string
}

interface BikeRow {
  id: string
  qr: string
  status: Bike["status"]
  station_id: string | null
  model: string
  condition: number
  usage_count: number
  last_service_date: string
  service_records: ServiceRecordRow[] | null
}

function mapRow(row: BikeRow): Bike {
  const history: ServiceRecord[] = (row.service_records ?? [])
    .map((r) => ({ id: r.id, date: r.created_at, type: r.type, notes: r.notes }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
  return {
    id: row.id,
    qr: row.qr,
    status: row.status,
    stationId: row.station_id,
    model: row.model,
    condition: row.condition,
    usageCount: row.usage_count,
    lastServiceDate: row.last_service_date,
    serviceHistory: history,
  }
}

/** Fetch the entire fleet with service history. RLS: any signed-in user. */
export async function fetchBikesFromDb(): Promise<Bike[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("bikes")
    .select(
      "id, qr, status, station_id, model, condition, usage_count, last_service_date, service_records (id, type, notes, created_at)",
    )
    .order("id")

  if (error) throw new Error(error.message)
  return ((data ?? []) as BikeRow[]).map(mapRow)
}

/** Register a new bicycle. RLS: admins only. */
export async function createBikeInDb(bike: Bike): Promise<{ ok: boolean; message: string }> {
  const supabase = createClient()
  const { error } = await supabase.from("bikes").insert({
    id: bike.id,
    qr: bike.qr,
    status: bike.status,
    station_id: bike.stationId,
    model: bike.model,
    condition: bike.condition,
    usage_count: bike.usageCount,
    last_service_date: bike.lastServiceDate,
  })
  if (error) {
    if (error.code === "42501") return { ok: false, message: "Only admins can register bicycles." }
    return { ok: false, message: `Could not register the bicycle: ${error.message}` }
  }
  return { ok: true, message: `${bike.id} registered.` }
}

/** Update a bicycle (status, station, model, condition, ...). RLS: admins only. */
export async function updateBikeInDb(
  id: string,
  data: Partial<Bike>,
): Promise<{ ok: boolean; message: string }> {
  const supabase = createClient()
  const patch: Record<string, unknown> = {}
  if (data.status !== undefined) patch.status = data.status
  if (data.stationId !== undefined) patch.station_id = data.stationId
  if (data.model !== undefined) patch.model = data.model
  if (data.condition !== undefined) patch.condition = data.condition
  if (data.usageCount !== undefined) patch.usage_count = data.usageCount
  if (data.lastServiceDate !== undefined) patch.last_service_date = data.lastServiceDate

  // .select() makes RLS-blocked updates detectable: Supabase returns 200 with
  // zero rows when the policy filters the row out, so we must count results.
  const { data: rows, error } = await supabase.from("bikes").update(patch).eq("id", id).select("id")
  if (error) {
    if (error.code === "42501") return { ok: false, message: "Only admins can edit bicycles." }
    return { ok: false, message: `Could not update the bicycle: ${error.message}` }
  }
  if (!rows || rows.length === 0) {
    return { ok: false, message: "Update failed — only admins can edit bicycles." }
  }
  return { ok: true, message: "Bicycle updated." }
}

/** Remove a bicycle from the fleet. RLS: admins only. */
export async function deleteBikeInDb(id: string): Promise<{ ok: boolean; message: string }> {
  const supabase = createClient()
  // .select() surfaces RLS-blocked deletes (200 with zero rows) as errors.
  const { data, error } = await supabase.from("bikes").delete().eq("id", id).select("id")
  if (error) {
    if (error.code === "42501") return { ok: false, message: "Only admins can remove bicycles." }
    return { ok: false, message: `Could not remove the bicycle: ${error.message}` }
  }
  if (!data || data.length === 0) {
    return { ok: false, message: "Delete failed — only admins can remove bicycles." }
  }
  return { ok: true, message: `${id} removed from the fleet.` }
}

/** Log a service record. RLS: admins only. */
export async function addServiceRecordInDb(
  bikeId: string,
  type: string,
  notes: string,
): Promise<{ ok: boolean; message: string }> {
  const supabase = createClient()
  const { error } = await supabase.from("service_records").insert({
    bike_id: bikeId,
    type,
    notes,
  })
  if (error) {
    if (error.code === "42501") return { ok: false, message: "Only admins can log service records." }
    return { ok: false, message: `Could not log the service: ${error.message}` }
  }
  return { ok: true, message: `${type} logged for ${bikeId}.` }
}
