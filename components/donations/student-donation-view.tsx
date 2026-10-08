"use client"

import { useRef, useState, type FormEvent } from "react"
import { useSWRConfig } from "swr"
import { DownloadIcon, HeartHandshakeIcon, SendIcon } from "lucide-react"
import { donationRequest, isDonationListKey } from "@/lib/donation-client"
import { toast } from "sonner"
import { createDonationDraft, DONATION_CONDITIONS, DONOR_YEARS, downloadDonationDocument, validateDonation, validateOwnershipProof, type DonationDetails, type DonationErrors, type DonationOwnershipProof } from "@/lib/donations"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { DonationDraftNotice, DonationGuidance } from "./donation-guidance"
import { DonationSelect } from "./donation-select"
import { OwnershipProofField } from "./ownership-proof-field"
import { DonationInbox } from "./donation-inbox"

export function StudentDonationView({ donor }: { donor: { name: string; email: string; department: string } }) {
  const [details, setDetails] = useState<DonationDetails>({
    donorName: donor.name, donorEmail: donor.email, department: donor.department, phone: "",
    studyYear: "final-year", graduationYear: String(new Date().getFullYear()),
    brand: "", model: "", colour: "", frameNumber: "", condition: "working", knownIssues: "",
    handoverLocation: "", handoverDate: "", ownershipConfirmed: false,
  })
  const [errors, setErrors] = useState<DonationErrors>({})
  const [downloaded, setDownloaded] = useState(false)
  const [proof, setProof] = useState<DonationOwnershipProof | null>(null)
  const [proofError, setProofError] = useState("")
  const [readingProof, setReadingProof] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submittedId, setSubmittedId] = useState("")
  const [submissionError, setSubmissionError] = useState("")
  const pendingSubmission = useRef<{ id: string; fingerprint: string } | null>(null)
  const submissionInFlight = useRef(false)
  const { mutate } = useSWRConfig()

  function change<K extends keyof DonationDetails>(key: K, value: DonationDetails[K]) {
    setDetails((previous) => ({ ...previous, [key]: value }))
    setErrors((previous) => ({ ...previous, [key]: undefined }))
    setDownloaded(false)
    setSubmittedId("")
    setSubmissionError("")
  }

  function validatedDraft() {
    if (readingProof) return null
    const validation = validateDonation(details)
    const ownershipError = validateOwnershipProof(proof)
    setErrors(validation)
    setProofError(ownershipError ?? "")
    if (Object.keys(validation).length || ownershipError) {
      toast.error("Check the highlighted donation details.")
      return null
    }
    return createDonationDraft(details, proof)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submissionInFlight.current || submittedId) return
    const draft = validatedDraft()
    if (!draft) return
    const fingerprint = JSON.stringify([draft.details, draft.ownershipProof])
    if (pendingSubmission.current?.fingerprint !== fingerprint) pendingSubmission.current = { id: crypto.randomUUID(), fingerprint }
    submissionInFlight.current = true
    setSubmitting(true)
    setSubmissionError("")
    try {
      const result = await donationRequest<{ id: string }>("/api/donations", {
        method: "POST", body: JSON.stringify({ id: pendingSubmission.current.id, draft }),
      })
      setSubmittedId(result.id)
      pendingSubmission.current = null
      toast.success("Donation submitted. The transport team can now review your request.")
      void mutate(isDonationListKey).catch(() => undefined)
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "Could not submit your donation. Keep this page open and try again.")
    } finally {
      submissionInFlight.current = false
      setSubmitting(false)
    }
  }

  function download() {
    if (readingProof || submitting) return
    const draft = validatedDraft()
    if (!draft) return
    try {
      downloadDonationDocument(draft, "cyclenet-donation-draft.json")
      setDownloaded(true)
      toast.success("Backup downloaded. Downloading alone does not submit a donation.")
    } catch {
      toast.error("Could not download the draft. Please try again.")
    }
  }

  function textField(key: Exclude<keyof DonationDetails, "ownershipConfirmed" | "studyYear" | "condition">, label: string, options: { placeholder?: string; type?: string; optional?: boolean; readOnly?: boolean; maxLength?: number } = {}) {
    return (
      <Field data-invalid={Boolean(errors[key])}>
        <FieldLabel htmlFor={`donation-${key}`}>{label}{options.optional ? " (optional)" : ""}</FieldLabel>
        <Input id={`donation-${key}`} value={String(details[key])} onChange={(event) => change(key, event.target.value)}
          type={options.type ?? "text"} placeholder={options.placeholder} readOnly={options.readOnly}
          maxLength={options.maxLength ?? 100} aria-invalid={Boolean(errors[key])}
          aria-describedby={errors[key] ? `donation-${key}-error` : undefined} />
        {errors[key] && <FieldError id={`donation-${key}-error`}>{errors[key]}</FieldError>}
      </Field>
    )
  }

  return (
    <div className="flex flex-col gap-5 font-sans">
      <DonationDraftNotice />
      <DonationInbox />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <form noValidate onSubmit={submit} className="min-w-0" aria-busy={submitting}>
          <fieldset disabled={submitting} className="min-w-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HeartHandshakeIcon aria-hidden="true" />Your cycle, its next chapter</CardTitle>
              <CardDescription>Tell us what you are leaving behind. Working cycles and cycles needing repairs are both welcome for assessment.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <FieldSet>
                  <FieldLegend>Student details</FieldLegend>
                  <FieldDescription>Your registered account identifies this request. The team will verify ownership before acceptance.</FieldDescription>
                  <FieldGroup className="grid gap-4 sm:grid-cols-2">
                    {textField("donorName", "Name", { readOnly: true })}
                    {textField("donorEmail", "College email", { readOnly: true, type: "email", maxLength: 254 })}
                    <DonationSelect id="donation-studyYear" label="Year of study" value={details.studyYear} items={DONOR_YEARS} onChange={(value) => change("studyYear", value as DonationDetails["studyYear"])} error={errors.studyYear} />
                    {textField("graduationYear", "Graduation year", { placeholder: "e.g. 2027", maxLength: 4 })}
                    {textField("phone", "Contact phone", { optional: true, type: "tel", placeholder: "A number for coordinating handover", maxLength: 20 })}
                    {textField("department", "Department", { optional: true })}
                  </FieldGroup>
                </FieldSet>
                <FieldSet>
                  <FieldLegend>Bicycle details</FieldLegend>
                  <FieldGroup className="grid gap-4 sm:grid-cols-2">
                    {textField("brand", "Brand", { placeholder: "e.g. Hero, BSA, Decathlon", maxLength: 80 })}
                    {textField("model", "Model / type", { placeholder: "e.g. geared mountain bike" })}
                    {textField("colour", "Colour", { placeholder: "e.g. blue", maxLength: 40 })}
                    {textField("frameNumber", "Frame / serial number", { optional: true, maxLength: 80 })}
                  </FieldGroup>
                  <DonationSelect id="donation-condition" label="Current condition" value={details.condition} items={DONATION_CONDITIONS} onChange={(value) => change("condition", value as DonationDetails["condition"])} error={errors.condition} />
                  <Field data-invalid={Boolean(errors.knownIssues)}>
                    <FieldLabel htmlFor="donation-knownIssues">Known issues or useful parts{details.condition === "working" ? " (optional)" : ""}</FieldLabel>
                    <Textarea id="donation-knownIssues" rows={3} maxLength={1500} value={details.knownIssues} onChange={(event) => change("knownIssues", event.target.value)} placeholder="Mention brakes, tyres, chain, rust, missing parts, or repairs needed." aria-invalid={Boolean(errors.knownIssues)} aria-describedby={errors.knownIssues ? "donation-issues-error" : undefined} />
                    {errors.knownIssues && <FieldError id="donation-issues-error">{errors.knownIssues}</FieldError>}
                  </Field>
                </FieldSet>
                <OwnershipProofField proof={proof} error={proofError} reading={readingProof} onReading={setReadingProof} onError={setProofError} onChange={(value) => { setProof(value); setProofError(""); setDownloaded(false); setSubmittedId(""); setSubmissionError("") }} />
                <FieldSet>
                  <FieldLegend>Proposed handover</FieldLegend>
                  <FieldDescription>The team must confirm these arrangements before you leave the cycle.</FieldDescription>
                  <FieldGroup className="grid gap-4 sm:grid-cols-2">
                    {textField("handoverLocation", "Hostel / handover location", { placeholder: "Hostel name and an accessible meeting point", maxLength: 200 })}
                    {textField("handoverDate", "Preferred handover date", { type: "date" })}
                  </FieldGroup>
                </FieldSet>
                <FieldSet>
                  <FieldLegend variant="label">Ownership confirmation</FieldLegend>
                  <Field orientation="horizontal" data-invalid={Boolean(errors.ownershipConfirmed)}>
                    <input id="donation-ownership" type="checkbox" className="mt-1 size-4 shrink-0 accent-primary" checked={details.ownershipConfirmed} onChange={(event) => change("ownershipConfirmed", event.target.checked)} aria-invalid={Boolean(errors.ownershipConfirmed)} aria-describedby="donation-ownership-note" />
                    <FieldContent>
                      <FieldLabel htmlFor="donation-ownership">I own this cycle and am willing to donate it.</FieldLabel>
                      <FieldDescription id="donation-ownership-note">This is not a borrowed campus cycle. My attached ownership document is genuine; the team must verify it before acceptance.</FieldDescription>
                      {errors.ownershipConfirmed && <FieldError>{errors.ownershipConfirmed}</FieldError>}
                    </FieldContent>
                  </Field>
                </FieldSet>
              </FieldGroup>
            </CardContent>
            <CardFooter className="flex flex-col items-stretch gap-3">
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={readingProof || submitting || Boolean(submittedId)}><SendIcon data-icon="inline-start" />{submitting ? "Submitting…" : submittedId ? "Donation submitted" : "Submit donation"}</Button>
                <Button type="button" variant="outline" disabled={readingProof || submitting} onClick={download}><DownloadIcon data-icon="inline-start" />Download backup</Button>
              </div>
              <p id="donation-online-note" className="text-sm leading-relaxed text-muted-foreground">Submitting saves your request and ownership document for admin review. Track the assessment above. A backup contains personal information; keep it private. Acceptance and handover must be confirmed by the team.</p>
              {submissionError && <p role="alert" className="text-sm text-destructive">{submissionError}</p>}
              {submittedId && <p role="status" className="break-all text-sm text-primary">Submitted for assessment. Reference: {submittedId}</p>}
              {downloaded && <p role="status" className="text-sm text-muted-foreground">Backup downloaded. Downloading alone does not send a request to admins.</p>}
            </CardFooter>
          </Card>
          </fieldset>
        </form>
        <DonationGuidance />
      </div>
    </div>
  )
}
