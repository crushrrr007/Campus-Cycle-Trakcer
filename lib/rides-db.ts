// Client-side data layer for rides backed by Supabase.
// Only used when a real Supabase session exists — demo mode stays in-memory.
// RLS: students see their own rides; admins see everything.
// Borrow/return go through security-definer RPCs so the "one active ride per
// user" and station-capacity rules are enforced atomically in the database.

import { createClient } from "@/lib/supabase/client"
import type { Ride } from "@/lib/types"

interface RideRow {
  id: string
  bike_id: string
  user_id: string
  source_station_id: string
  dest_station_id: string | null
  borrow_time: string
  return_time: string | null
  duration_min: number | null
  status: Ride["status"]
  profiles: { full_name: string } | null
}

function mapRow(row: RideRow): Ride {
  return {
    id: row.id,
    bikeId: row.bike_id,
    userId: row.user_id,
    userName: row.profiles?.full_name ?? "—",
    sourceStationId: row.source_station_id,
    destStationId: row.dest_station_id,
    borrowTime: row.borrow_time,
    returnTime: row.return_time,
    durationMin: row.duration_min,
    status: row.status,
  }
}

/** Fetch rides (RLS-scoped: own rides for students, all for admins). */
export async function fetchRidesFromDb(): Promise<Ride[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("rides")
    .select(
      "id, bike_id, user_id, source_station_id, dest_station_id, borrow_time, return_time, duration_min, status, profiles (full_name)",
    )
    .order("borrow_time", { ascending: false })

  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as RideRow[]).map(mapRow)
}

interface RpcResult {
  ok: boolean
  message: string
}

/** Borrow a bike via the borrow_bike RPC (atomic, one active ride per user). */
export async function borrowBikeInDb(bikeId: string): Promise<RpcResult> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("borrow_bike", { p_bike_id: bikeId })
  if (error) {
    if (error.code === "PGRST202") {
      return {
        ok: false,
        message:
          "The borrow_bike function is missing in your database. Run supabase/migrations/004_ride_rpcs.sql in the Supabase SQL editor.",
      }
    }
    return { ok: false, message: `Could not borrow the bicycle: ${error.message}` }
  }
  return data as RpcResult
}

/** Return a bike via the return_bike RPC (atomic, checks dock capacity). */
export async function returnBikeInDb(bikeId: string, destStationId: string): Promise<RpcResult> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("return_bike", {
    p_bike_id: bikeId,
    p_dest_station_id: destStationId,
  })
  if (error) {
    if (error.code === "PGRST202") {
      return {
        ok: false,
        message:
          "The return_bike function is missing in your database. Run supabase/migrations/004_ride_rpcs.sql in the Supabase SQL editor.",
      }
    }
    return { ok: false, message: `Could not return the bicycle: ${error.message}` }
  }
  return data as RpcResult
}
