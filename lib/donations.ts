export const DONATION_CONDITIONS = [
  { value: "working", label: "Working — rideable" },
  { value: "repair", label: "Needs repairs" },
  { value: "parts", label: "Not rideable / parts only" },
] as const

export const DONOR_YEARS = [
  { value: "final-year", label: "Final year / graduating" },
  { value: "other-year", label: "Other year" },
  { value: "alumnus", label: "Recently graduated" },
] as const

export const DONATION_OUTCOMES = [
  { value: "fleet", label: "Ready for the fleet", description: "Register only after handover and a completed safety inspection." },
  { value: "repair", label: "Repair, then reassess", description: "List the repairs needed. Keep the cycle out of service until it passes inspection." },
  { value: "parts", label: "Recover spare parts", description: "Identify reusable components. Do not register the complete cycle as rideable." },
  { value: "decline", label: "Unable to accept", description: "Record a reason and arrange for the student to retain or collect the cycle." },
] as const

export type DonationCondition = typeof DONATION_CONDITIONS[number]["value"]
export type DonorYear = typeof DONOR_YEARS[number]["value"]
export type DonationOutcome = typeof DONATION_OUTCOMES[number]["value"]

export interface DonationDetails {
  donorName: string
  donorEmail: string
  department: string
  phone: string
  studyYear: DonorYear
  graduationYear: string
  brand: string
  model: string
  colour: string
  frameNumber: string
  condition: DonationCondition
  knownIssues: string
  handoverLocation: string
  handoverDate: string
  ownershipConfirmed: boolean
}

export interface DonationOwnershipProof {
  filename: string
  mimeType: "application/pdf" | "image/jpeg" | "image/png"
  sizeBytes: number
  base64: string
  ownerName: string
  explanation: string
}

export interface DonationDraft {
  kind: "cyclenet-donation-draft"
  version: 1 | 2
  createdAt: string
  details: DonationDetails
  ownershipProof?: DonationOwnershipProof
}

export interface DonationAssessment {
  outcome: DonationOutcome
  notes: string
  received: boolean
  safetyChecked: boolean
  ownershipVerified: boolean
  ownershipNotes: string
}

export interface DonationRecord {
  id: string
  createdAt: string
  reviewedAt: string | null
  details: DonationDetails
  assessment: DonationAssessment | null
}

export interface DonationList {
  donations: DonationRecord[]
  hasMore: boolean
}

export function donationStatus(assessment: DonationAssessment | null): string {
  return assessment ? DONATION_OUTCOMES.find((item) => item.value === assessment.outcome)?.label ?? "Reviewed" : "Awaiting assessment"
}

export type DonationErrors = Partial<Record<keyof DonationDetails, string>>
export const MAX_OWNERSHIP_PROOF_BYTES = 2 * 1024 * 1024
export const MAX_DONATION_FILE_BYTES = 3 * 1024 * 1024
const PROOF_SIGNATURES = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46, 0x2d],
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
} as const

export function validateOwnershipProof(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Attach an invoice, purchase receipt, or signed ownership-transfer document."
  const proof = value as Partial<DonationOwnershipProof>
  if (typeof proof.ownerName !== "string" || !proof.ownerName.trim() || proof.ownerName.length > 100) return "Enter the owner or purchaser name shown on the document (up to 100 characters)."
  if (typeof proof.explanation !== "string" || proof.explanation.length > 1000) return "Keep the ownership explanation within 1000 characters."
  if (typeof proof.filename !== "string" || !proof.filename.trim() || proof.filename.length > 150 || /[\x00-\x1f/\\]/.test(proof.filename)) return "Use a document filename without path separators (up to 150 characters)."
  if (!proof.mimeType || !Object.hasOwn(PROOF_SIGNATURES, proof.mimeType)) return "Choose a PDF, JPG, or PNG ownership document."
  if (typeof proof.sizeBytes !== "number" || !Number.isInteger(proof.sizeBytes) || proof.sizeBytes < 1 || proof.sizeBytes > MAX_OWNERSHIP_PROOF_BYTES) return "Choose an ownership document up to 2 MB."
  if (typeof proof.base64 !== "string" || proof.base64.length !== 4 * Math.ceil(proof.sizeBytes / 3) || !/^[A-Za-z0-9+/]+={0,2}$/.test(proof.base64)) return "The ownership document data is invalid. Attach the original file again."
  let bytes: string
  try { bytes = atob(proof.base64) } catch { return "The ownership document data is invalid. Attach the original file again." }
  if (bytes.length !== proof.sizeBytes || !PROOF_SIGNATURES[proof.mimeType].every((byte, index) => bytes.charCodeAt(index) === byte)) return "The file contents do not match its PDF, JPG, or PNG type. Attach the original document."
  return null
}

export async function readOwnershipProof(file: File): Promise<DonationOwnershipProof> {
  if (file.size < 1 || file.size > MAX_OWNERSHIP_PROOF_BYTES) throw new Error("Choose an ownership document up to 2 MB.")
  if (!Object.hasOwn(PROOF_SIGNATURES, file.type)) throw new Error("Choose a PDF, JPG, or PNG ownership document.")
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ""
  for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...bytes.subarray(index, index + 8192))
  const proof: DonationOwnershipProof = {
    filename: file.name.replace(/[\x00-\x1f/\\]/g, "_").slice(0, 150),
    mimeType: file.type as DonationOwnershipProof["mimeType"], sizeBytes: bytes.length,
    base64: btoa(binary), ownerName: "", explanation: "",
  }
  const error = validateOwnershipProof({ ...proof, ownerName: "Pending document review" })
  if (error) throw new Error(error)
  return proof
}

export function downloadOwnershipProof(proof: DonationOwnershipProof) {
  const error = validateOwnershipProof(proof)
  if (error) throw new Error(error)
  const bytes = Uint8Array.from(atob(proof.base64), (character) => character.charCodeAt(0))
  const extension = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" }[proof.mimeType]
  downloadBlob(new Blob([bytes], { type: proof.mimeType }), `cyclenet-ownership-proof.${extension}`)
}

export function validateDonation(details: DonationDetails): DonationErrors {
  const errors: DonationErrors = {}
  const required = { donorName: 100, donorEmail: 254, brand: 80, model: 100, colour: 40, handoverLocation: 200 }
  for (const [key, limit] of Object.entries(required)) {
    const field = key as keyof DonationDetails
    const value = details[field]
    if (typeof value !== "string" || !value.trim() || value.length > limit) errors[field] = `Enter ${key.replace(/([A-Z])/g, " $1").toLowerCase()} (up to ${limit} characters).`
  }
  for (const [key, limit] of Object.entries({ department: 100, phone: 20, frameNumber: 80, knownIssues: 1500 })) {
    const field = key as keyof DonationDetails
    if (typeof details[field] !== "string" || (details[field] as string).length > limit) errors[field] = `Use no more than ${limit} characters.`
  }
  if (typeof details.donorEmail !== "string" || !/^[^\s@]+@nitt\.edu$/i.test(details.donorEmail.trim())) errors.donorEmail = "Use your registered NIT Trichy email."
  if (typeof details.phone === "string" && details.phone && !/^\+?[\d ()-]{7,20}$/.test(details.phone)) errors.phone = "Enter a valid contact phone number, or leave it blank."
  if (!DONOR_YEARS.some((year) => year.value === details.studyYear)) errors.studyYear = "Choose your year of study."
  if (typeof details.graduationYear !== "string" || !/^(20\d{2}|2100)$/.test(details.graduationYear)) errors.graduationYear = "Enter a graduation year between 2000 and 2100."
  if (!DONATION_CONDITIONS.some((condition) => condition.value === details.condition)) errors.condition = "Choose the current condition."
  if (details.condition !== "working" && (typeof details.knownIssues !== "string" || !details.knownIssues.trim())) errors.knownIssues = "Describe the repairs needed or usable spare parts."
  if (typeof details.handoverDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(details.handoverDate) || !Number.isFinite(Date.parse(details.handoverDate)) || new Date(details.handoverDate).toISOString().slice(0, 10) !== details.handoverDate) errors.handoverDate = "Choose a valid handover date."
  if (details.ownershipConfirmed !== true) errors.ownershipConfirmed = "Confirm that you own this cycle and can donate it."
  return errors
}

export function createDonationDraft(details: DonationDetails, ownershipProof: DonationOwnershipProof | null): DonationDraft {
  if (Object.keys(validateDonation(details)).length) throw new Error("Complete the required donation details first.")
  const proofError = validateOwnershipProof(ownershipProof)
  if (proofError || !ownershipProof) throw new Error(proofError ?? "Attach ownership proof.")
  const clean = { ...details }
  for (const key of Object.keys(clean) as (keyof DonationDetails)[]) {
    if (typeof clean[key] === "string") Object.assign(clean, { [key]: (clean[key] as string).trim() })
  }
  clean.donorEmail = clean.donorEmail.toLowerCase()
  return {
    kind: "cyclenet-donation-draft", version: 2, createdAt: new Date().toISOString(), details: clean,
    ownershipProof: pickOwnershipProof(ownershipProof),
  }
}

export function parseDonationDraft(text: string): DonationDraft {
  if (new TextEncoder().encode(text).length > MAX_DONATION_FILE_BYTES) throw new Error("Choose a donation draft up to 3 MB, including ownership proof.")
  let input: unknown
  try { input = JSON.parse(text) } catch { throw new Error("This is not a valid JSON donation draft.") }
  if (!input || typeof input !== "object") throw new Error("Choose a CycleNet donation draft.")
  const draft = input as Partial<DonationDraft>
  if (draft.kind !== "cyclenet-donation-draft" || (draft.version !== 1 && draft.version !== 2) || typeof draft.createdAt !== "string" || !Number.isFinite(Date.parse(draft.createdAt)) || !draft.details || typeof draft.details !== "object" || Array.isArray(draft.details)) throw new Error("Choose an original CycleNet donation draft (version 1 or 2).")
  if (Object.keys(validateDonation(draft.details)).length) throw new Error("The donation draft has missing or invalid details. Ask the student to export it again.")
  if (draft.version === 2) {
    const proofError = validateOwnershipProof(draft.ownershipProof)
    if (proofError) throw new Error(proofError)
  }
  // Pick known fields: imported documents are untrusted and cannot carry fleet IDs or account roles.
  const details = draft.details
  return {
    kind: "cyclenet-donation-draft", version: draft.version, createdAt: draft.createdAt,
    ...(draft.version === 2 && draft.ownershipProof ? { ownershipProof: pickOwnershipProof(draft.ownershipProof) } : {}),
    details: {
      donorName: details.donorName, donorEmail: details.donorEmail, department: details.department,
      phone: details.phone, studyYear: details.studyYear, graduationYear: details.graduationYear,
      brand: details.brand, model: details.model, colour: details.colour, frameNumber: details.frameNumber,
      condition: details.condition, knownIssues: details.knownIssues, handoverLocation: details.handoverLocation,
      handoverDate: details.handoverDate, ownershipConfirmed: true,
    },
  }
}

function pickOwnershipProof(proof: DonationOwnershipProof): DonationOwnershipProof {
  return {
    filename: proof.filename, mimeType: proof.mimeType, sizeBytes: proof.sizeBytes, base64: proof.base64,
    ownerName: proof.ownerName.trim(), explanation: proof.explanation.trim(),
  }
}

export function validateAssessment(assessment: DonationAssessment, proof?: DonationOwnershipProof): string | null {
  if (!DONATION_OUTCOMES.some((outcome) => outcome.value === assessment.outcome)) return "Choose an assessment outcome."
  if (typeof assessment.notes !== "string" || !assessment.notes.trim() || assessment.notes.length > 2000) return "Add assessment notes (up to 2000 characters)."
  if (typeof assessment.received !== "boolean" || typeof assessment.safetyChecked !== "boolean" || typeof assessment.ownershipVerified !== "boolean") return "Confirm the ownership, handover and inspection checks."
  if (typeof assessment.ownershipNotes !== "string" || assessment.ownershipNotes.length > 1000) return "Add ownership verification notes (up to 1000 characters)."
  if (assessment.outcome !== "decline") {
    if (validateOwnershipProof(proof)) return "Ownership proof is missing or invalid. Request a new draft before recommending acceptance."
    if (!assessment.ownershipVerified) return "Verify the student's identity, ownership document and bicycle before recommending acceptance."
    if (!assessment.ownershipNotes.trim()) return "Record how you matched the document and bicycle to the student, including any ownership transfer."
  }
  if (assessment.outcome === "fleet" && (!assessment.received || !assessment.safetyChecked)) return "Fleet-ready assessments require physical handover and a passed safety inspection."
  return null
}

export function downloadDonationDocument(value: unknown, filename: string) {
  downloadBlob(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }), filename)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
