// Client-side data layer for docking stations backed by Supabase.
// Only used when a real Supabase session exists — demo mode stays in-memory.

import { createClient } from "@/lib/supabase/client"
import type { Station } from "@/lib/types"

export type StationDef = Omit<Station, "status">

interface StationRow {
  id: string
  name: string
  short_name: string
  capacity: number
  zone: string
  lat: number
  lng: number
  map_x: number
  map_y: number
}

function mapRow(row: StationRow): StationDef {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    capacity: row.capacity,
    zone: row.zone,
    lat: row.lat,
    lng: row.lng,
    x: row.map_x,
    y: row.map_y,
  }
}

/** Fetch all stations. RLS: any signed-in user can read. */
export async function fetchStationsFromDb(): Promise<StationDef[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("stations")
    .select("id, name, short_name, capacity, zone, lat, lng, map_x, map_y")
    .order("name")

  if (error) throw new Error(error.message)
  return ((data ?? []) as StationRow[]).map(mapRow)
}

/** Insert a station. RLS: admins only. */
export async function createStationInDb(def: StationDef): Promise<{ ok: boolean; message: string }> {
  const supabase = createClient()
  const { error } = await supabase.from("stations").insert({
    id: def.id,
    name: def.name,
    short_name: def.shortName,
    capacity: def.capacity,
    zone: def.zone,
    lat: def.lat,
    lng: def.lng,
    map_x: def.x,
    map_y: def.y,
  })
  if (error) {
    if (error.code === "42501") {
      return { ok: false, message: "Only admins can add stations." }
    }
    return { ok: false, message: `Could not add the station: ${error.message}` }
  }
  return { ok: true, message: `${def.name} is now live with ${def.capacity} docks.` }
}

/** Update a station (position, capacity, details). RLS: admins only. */
export async function updateStationInDb(
  id: string,
  data: Partial<StationDef>,
): Promise<{ ok: boolean; message: string }> {
  const supabase = createClient()
  const patch: Record<string, unknown> = {}
  if (data.name !== undefined) patch.name = data.name
  if (data.shortName !== undefined) patch.short_name = data.shortName
  if (data.capacity !== undefined) patch.capacity = data.capacity
  if (data.zone !== undefined) patch.zone = data.zone
  if (data.lat !== undefined) patch.lat = data.lat
  if (data.lng !== undefined) patch.lng = data.lng
  if (data.x !== undefined) patch.map_x = data.x
  if (data.y !== undefined) patch.map_y = data.y

  // .select() makes RLS-blocked updates detectable: Supabase returns 200 with
  // zero rows when the policy filters the row out, so we must count results.
  const { data: rows, error } = await supabase.from("stations").update(patch).eq("id", id).select("id")
  if (error) {
    if (error.code === "42501") {
      return { ok: false, message: "Only admins can edit stations." }
    }
    return { ok: false, message: `Could not update the station: ${error.message}` }
  }
  if (!rows || rows.length === 0) {
    return { ok: false, message: "Update failed — only admins can edit stations." }
  }
  return { ok: true, message: "Station updated." }
}

/** Delete a station. RLS: admins only. */
export async function deleteStationInDb(id: string): Promise<{ ok: boolean; message: string }> {
  const supabase = createClient()
  // .select() surfaces RLS-blocked deletes (200 with zero rows) as errors.
  const { data, error } = await supabase.from("stations").delete().eq("id", id).select("id")
  if (error) {
    if (error.code === "42501") {
      return { ok: false, message: "Only admins can delete stations." }
    }
    // FK restriction — bikes/rides still reference this station
    if (error.code === "23503") {
      return {
        ok: false,
        message: "This station still has bikes or ride history attached. Move the bikes first.",
      }
    }
    return { ok: false, message: `Could not delete the station: ${error.message}` }
  }
  if (!data || data.length === 0) {
    return { ok: false, message: "Delete failed — only admins can delete stations." }
  }
  return { ok: true, message: "Station removed." }
}
