import type { NextRequest } from "next/server"
import { validateAssessment, type DonationAssessment, type DonationOwnershipProof } from "@/lib/donations"
import { allowedDonationMutation, DONATION_COLUMNS, donationRecord, donationReply, readDonationJson, UUID_PATTERN, type DonationRow } from "@/lib/donations-server"
import { createClient } from "@/lib/supabase/server"
import { getSessionUser } from "@/lib/supabase/session"

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: Context) {
  try {
    const user = await getSessionUser()
    if (!user) return donationReply({ error: "Sign in to view this donation." }, 401)
    const { id } = await context.params
    if (!UUID_PATTERN.test(id)) return donationReply({ error: "Donation not found." }, 404)
    const supabase = await createClient()
    if (!supabase) return donationReply({ error: "Donation storage is unavailable." }, 503)
    let query = supabase.from("donations").select(DONATION_COLUMNS).eq("id", id)
    if (user.role !== "admin") query = query.eq("user_id", user.id)
    const { data, error } = await query.maybeSingle()
    if (error) return donationReply({ error: "Could not load this donation." }, 503)
    if (!data) return donationReply({ error: "Donation not found." }, 404)
    const { data: attachment, error: proofError } = await supabase.from("donation_proofs").select("proof").eq("donation_id", id).maybeSingle()
    if (proofError) return donationReply({ error: "Could not load ownership proof. Try again before reviewing." }, 503)
    return donationReply({ donation: donationRecord(data as unknown as DonationRow), ownershipProof: attachment?.proof ?? null })
  } catch {
    return donationReply({ error: "Could not connect to donation storage." }, 503)
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  if (!allowedDonationMutation(request)) return donationReply({ error: "This request is not allowed." }, 403)
  try {
    const user = await getSessionUser()
    if (!user) return donationReply({ error: "Your session has expired. Sign in again." }, 401)
    if (user.role !== "admin") return donationReply({ error: "Admin access required." }, 403)
    const { id } = await context.params
    if (!UUID_PATTERN.test(id)) return donationReply({ error: "Donation not found." }, 404)
    let body: Record<string, unknown>
    try { body = await readDonationJson(request, 16000) } catch (error) {
      return donationReply({ error: error instanceof Error ? error.message : "Invalid assessment." }, 400)
    }
    if (body.reviewedAt !== null && (typeof body.reviewedAt !== "string" || !Number.isFinite(Date.parse(body.reviewedAt)))) return donationReply({ error: "Reopen the donation before saving your review." }, 400)
    if (!body.assessment || typeof body.assessment !== "object" || Array.isArray(body.assessment)) return donationReply({ error: "Invalid assessment." }, 400)
    const value = body.assessment as DonationAssessment
    const assessment: DonationAssessment = {
      outcome: value.outcome, notes: value.notes, received: value.received, safetyChecked: value.safetyChecked,
      ownershipVerified: value.ownershipVerified, ownershipNotes: value.ownershipNotes,
    }
    const supabase = await createClient()
    if (!supabase) return donationReply({ error: "Donation storage is unavailable." }, 503)
    const { data: donation, error: readError } = await supabase.from("donations").select("id").eq("id", id).maybeSingle()
    if (readError) return donationReply({ error: "Could not load this donation." }, 503)
    if (!donation) return donationReply({ error: "Donation not found." }, 404)
    const { data: attachment, error: proofError } = await supabase.from("donation_proofs").select("proof").eq("donation_id", id).maybeSingle()
    if (proofError) return donationReply({ error: "Could not verify the stored ownership proof. Try again." }, 503)
    const validation = validateAssessment(assessment, attachment?.proof as DonationOwnershipProof | undefined)
    if (validation) return donationReply({ error: validation }, 400)
    assessment.notes = assessment.notes.trim()
    assessment.ownershipNotes = assessment.ownershipNotes.trim()
    let query = supabase.from("donations").update({ assessment }).eq("id", id)
    query = body.reviewedAt === null ? query.is("reviewed_at", null) : query.eq("reviewed_at", body.reviewedAt)
    const { data, error } = await query.select(DONATION_COLUMNS).maybeSingle()
    if (error) return donationReply({ error: "Could not save the assessment. Try again." }, 503)
    if (!data) return donationReply({ error: "Another admin updated this donation. Reopen it to review the latest assessment." }, 409)
    return donationReply({ donation: donationRecord(data as unknown as DonationRow) })
  } catch {
    return donationReply({ error: "Could not connect to donation storage. Your assessment was not confirmed saved." }, 503)
  }
}
