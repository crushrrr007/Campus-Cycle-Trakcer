import "server-only"
import { NextResponse, type NextRequest } from "next/server"
import type { DonationAssessment, DonationDetails, DonationRecord } from "@/lib/donations"

export const DONATION_COLUMNS = "id, details, assessment, created_at, reviewed_at"
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface DonationRow {
  id: string
  details: DonationDetails
  assessment: DonationAssessment | null
  created_at: string
  reviewed_at: string | null
}

export function donationRecord(row: DonationRow): DonationRecord {
  return { id: row.id, details: row.details, assessment: row.assessment, createdAt: row.created_at, reviewedAt: row.reviewed_at }
}

export function donationReply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } })
}

export function allowedDonationMutation(request: NextRequest): boolean {
  const origin = request.headers.get("origin")
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host"))?.split(",")[0].trim()
  const fetchSite = request.headers.get("sec-fetch-site")
  try {
    const url = new URL(origin ?? "")
    return ["http:", "https:"].includes(url.protocol) && url.origin === origin && fetchSite !== "cross-site"
      && (fetchSite === "same-origin" || url.host === host || origin === request.nextUrl.origin)
  } catch {
    return false
  }
}

export async function readDonationJson(request: NextRequest, limit: number): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("Send a JSON request.")
  if (Number(request.headers.get("content-length")) > limit) throw new Error("Request is too large.")
  const reader = request.body?.getReader()
  if (!reader) throw new Error("Invalid request.")
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > limit) {
        await reader.cancel()
        throw new Error("Request is too large.")
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  let parsed: unknown
  try { parsed = JSON.parse(new TextDecoder().decode(bytes)) } catch { throw new Error("Invalid JSON request.") }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid request.")
  return parsed as Record<string, unknown>
}
