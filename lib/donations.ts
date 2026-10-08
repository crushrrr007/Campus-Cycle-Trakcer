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

export interface DonationDraft {
  kind: "cyclenet-donation-draft"
  version: 1
  createdAt: string
  details: DonationDetails
}

export interface DonationAssessment {
  outcome: DonationOutcome
  notes: string
  received: boolean
  safetyChecked: boolean
}

export type DonationErrors = Partial<Record<keyof DonationDetails, string>>
export const MAX_DONATION_FILE_BYTES = 64 * 1024

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

export function createDonationDraft(details: DonationDetails): DonationDraft {
  if (Object.keys(validateDonation(details)).length) throw new Error("Complete the required donation details first.")
  const clean = { ...details }
  for (const key of Object.keys(clean) as (keyof DonationDetails)[]) {
    if (typeof clean[key] === "string") Object.assign(clean, { [key]: (clean[key] as string).trim() })
  }
  clean.donorEmail = clean.donorEmail.toLowerCase()
  return { kind: "cyclenet-donation-draft", version: 1, createdAt: new Date().toISOString(), details: clean }
}

export function parseDonationDraft(text: string): DonationDraft {
  if (new TextEncoder().encode(text).length > MAX_DONATION_FILE_BYTES) throw new Error("Choose a donation draft smaller than 64 KB.")
  let input: unknown
  try { input = JSON.parse(text) } catch { throw new Error("This is not a valid JSON donation draft.") }
  if (!input || typeof input !== "object") throw new Error("Choose a CycleNet donation draft.")
  const draft = input as Partial<DonationDraft>
  if (draft.kind !== "cyclenet-donation-draft" || draft.version !== 1 || typeof draft.createdAt !== "string" || !Number.isFinite(Date.parse(draft.createdAt)) || !draft.details || typeof draft.details !== "object" || Array.isArray(draft.details)) throw new Error("Choose an original CycleNet donation draft (version 1).")
  if (Object.keys(validateDonation(draft.details)).length) throw new Error("The donation draft has missing or invalid details. Ask the student to export it again.")
  // Pick known fields: imported documents are untrusted and cannot carry fleet IDs or account roles.
  const details = draft.details
  return {
    kind: "cyclenet-donation-draft", version: 1, createdAt: draft.createdAt,
    details: {
      donorName: details.donorName, donorEmail: details.donorEmail, department: details.department,
      phone: details.phone, studyYear: details.studyYear, graduationYear: details.graduationYear,
      brand: details.brand, model: details.model, colour: details.colour, frameNumber: details.frameNumber,
      condition: details.condition, knownIssues: details.knownIssues, handoverLocation: details.handoverLocation,
      handoverDate: details.handoverDate, ownershipConfirmed: true,
    },
  }
}

export function validateAssessment(assessment: DonationAssessment): string | null {
  if (!DONATION_OUTCOMES.some((outcome) => outcome.value === assessment.outcome)) return "Choose an assessment outcome."
  if (typeof assessment.notes !== "string" || !assessment.notes.trim() || assessment.notes.length > 2000) return "Add assessment notes (up to 2000 characters)."
  if (typeof assessment.received !== "boolean" || typeof assessment.safetyChecked !== "boolean") return "Confirm the handover and inspection checks."
  if (assessment.outcome === "fleet" && (!assessment.received || !assessment.safetyChecked)) return "Fleet-ready assessments require physical handover and a passed safety inspection."
  return null
}

export function downloadDonationDocument(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }))
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
