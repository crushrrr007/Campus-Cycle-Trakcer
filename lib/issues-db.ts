// Client-side data layer for issue reports backed by Supabase.
// Only used when a real Supabase session exists — demo mode stays in-memory.

import { createClient } from "@/lib/supabase/client"
import type { IssueCategory, IssueReport, IssueStatus } from "@/lib/types"

interface IssueRow {
  id: string
  user_id: string
  bike_id: string | null
  station_id: string | null
  category: IssueCategory
  description: string
  status: IssueStatus
  created_at: string
  profiles: { full_name: string; email: string } | null
}

function mapRow(row: IssueRow): IssueReport {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.profiles?.full_name || "Unknown rider",
    userEmail: row.profiles?.email || "",
    bikeId: row.bike_id,
    stationId: row.station_id,
    category: row.category,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
  }
}

/**
 * Fetch issues from Supabase. RLS scopes the result automatically:
 * students receive only their own reports, admins receive all of them.
 */
export async function fetchIssuesFromDb(): Promise<IssueReport[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("issues")
    .select(
      "id, user_id, bike_id, station_id, category, description, status, created_at, profiles(full_name, email)",
    )
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as IssueRow[]).map(mapRow)
}

export async function createIssueInDb(input: {
  userId: string
  bikeId: string | null
  stationId: string | null
  category: IssueCategory
  description: string
}): Promise<{ ok: boolean; message: string }> {
  const supabase = createClient()
  const { error } = await supabase.from("issues").insert({
    user_id: input.userId,
    bike_id: input.bikeId,
    station_id: input.stationId,
    category: input.category,
    description: input.description,
  })

  if (error) {
    // FK violation → the bike/station code doesn't exist in the database
    if (error.code === "23503") {
      return {
        ok: false,
        message: input.bikeId
          ? `No bicycle "${input.bikeId}" exists in the system. Check the code and try again.`
          : "The selected station no longer exists.",
      }
    }
    return { ok: false, message: `Could not submit the report: ${error.message}` }
  }
  return { ok: true, message: "Thanks! Your issue has been sent to the maintenance team." }
}

export async function updateIssueStatusInDb(
  id: string,
  status: IssueStatus,
): Promise<{ ok: boolean; message: string }> {
  const supabase = createClient()
  const { error } = await supabase.from("issues").update({ status }).eq("id", id)
  if (error) return { ok: false, message: `Could not update the issue: ${error.message}` }
  return { ok: true, message: `Issue marked as ${status.replace("-", " ")}.` }
}
