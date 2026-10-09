import type { NextRequest } from "next/server"
import { createDonationDraft, MAX_DONATION_FILE_BYTES, parseDonationDraft } from "@/lib/donations"
import { allowedDonationMutation, DONATION_COLUMNS, donationRecord, donationReply, readDonationJson, UUID_PATTERN, type DonationRow } from "@/lib/donations-server"
import { createClient } from "@/lib/supabase/server"
import { getSessionUser } from "@/lib/supabase/session"

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) return donationReply({ error: "Sign in to view donations." }, 401)
    const scope = request.nextUrl.searchParams.get("scope") ?? "student"
    if (scope !== "student" && scope !== "admin") return donationReply({ error: "Invalid donation view." }, 400)
    if (scope === "admin" && user.role !== "admin") return donationReply({ error: "Admin access required." }, 403)
    const page = Number(request.nextUrl.searchParams.get("page") ?? "0")
    if (!Number.isSafeInteger(page) || page < 0 || page > 10000) return donationReply({ error: "Invalid page." }, 400)
    const supabase = await createClient()
    if (!supabase) return donationReply({ error: "Donation storage is unavailable." }, 503)
    let query = supabase.from("donations").select(DONATION_COLUMNS).order("created_at", { ascending: false }).order("id", { ascending: false })
    if (scope === "student") query = query.eq("user_id", user.id)
    const { data, error } = await query.range(page * 20, page * 20 + 20)
    if (error) return donationReply({ error: "Could not load donations. Please try again." }, 503)
    const rows = data as unknown as DonationRow[]
    return donationReply({ donations: rows.slice(0, 20).map(donationRecord), hasMore: rows.length > 20 })
  } catch {
    return donationReply({ error: "Could not connect to donation storage. Please try again." }, 503)
  }
}

export async function POST(request: NextRequest) {
  if (!allowedDonationMutation(request)) return donationReply({ error: "This request is not allowed." }, 403)
  try {
    const user = await getSessionUser()
    if (!user) return donationReply({ error: "Your session has expired. Sign in again." }, 401)
    let body: Record<string, unknown>
    try { body = await readDonationJson(request, MAX_DONATION_FILE_BYTES) } catch (error) {
      return donationReply({ error: error instanceof Error ? error.message : "Invalid submission." }, 400)
    }
    if (typeof body.id !== "string" || !UUID_PATTERN.test(body.id)) return donationReply({ error: "Invalid submission reference." }, 400)
    let draft
    try {
      const parsed = parseDonationDraft(JSON.stringify(body.draft))
      draft = createDonationDraft({ ...parsed.details, donorName: user.name, donorEmail: user.email }, parsed.ownershipProof ?? null)
    } catch (error) {
      return donationReply({ error: error instanceof Error ? error.message : "Check your donation details and ownership proof." }, 400)
    }
    const supabase = await createClient()
    if (!supabase) return donationReply({ error: "Donation storage is unavailable." }, 503)
    const { error } = await supabase.rpc("submit_cycle_donation", { p_id: body.id, p_details: draft.details, p_proof: draft.ownershipProof })
    if (error) return donationReply({ error: "Could not save your donation. Keep this page open and try again, or download a backup." }, 503)
    return donationReply({ id: body.id }, 201)
  } catch {
    return donationReply({ error: "Could not connect to donation storage. Keep your draft and try again." }, 503)
  }
}
