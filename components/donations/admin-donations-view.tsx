"use client"

import { useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { useSWRConfig } from "swr"
import { ClipboardCheckIcon, DownloadIcon, FileJsonIcon, SaveIcon } from "lucide-react"
import { donationRequest, isDonationListKey } from "@/lib/donation-client"
import { toast } from "sonner"
import { DONATION_CONDITIONS, DONATION_OUTCOMES, DONOR_YEARS, MAX_DONATION_FILE_BYTES, donationStatus, downloadDonationDocument, downloadOwnershipProof, parseDonationDraft, validateAssessment, type DonationAssessment, type DonationDraft, type DonationOwnershipProof, type DonationRecord } from "@/lib/donations"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { DonationDraftNotice } from "./donation-guidance"
import { DonationInbox } from "./donation-inbox"

const INITIAL_ASSESSMENT: DonationAssessment = { outcome: "repair", notes: "", received: false, safetyChecked: false, ownershipVerified: false, ownershipNotes: "" }

export function AdminDonationsView() {
  const [draft, setDraft] = useState<DonationDraft | null>(null)
  const [assessment, setAssessment] = useState<DonationAssessment>(INITIAL_ASSESSMENT)
  const [importError, setImportError] = useState("")
  const [reviewError, setReviewError] = useState("")
  const [reading, setReading] = useState(false)
  const [exported, setExported] = useState(false)
  const [selected, setSelected] = useState<DonationRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const operationInFlight = useRef(false)
  const { mutate } = useSWRConfig()

  async function openRequest(id: string) {
    if (operationInFlight.current) return
    operationInFlight.current = true
    setReading(true)
    setImportError("")
    setReviewError("")
    setDraft(null)
    setSelected(null)
    setAssessment(INITIAL_ASSESSMENT)
    setExported(false)
    setSaved(false)
    try {
      const result = await donationRequest<{ donation: DonationRecord; ownershipProof: DonationOwnershipProof | null }>(`/api/donations/${id}`)
      setSelected(result.donation)
      setDraft({ kind: "cyclenet-donation-draft", version: 2, createdAt: result.donation.createdAt, details: result.donation.details, ownershipProof: result.ownershipProof ?? undefined })
      setAssessment(result.donation.assessment ?? INITIAL_ASSESSMENT)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Could not open the donation. Please try again.")
    } finally {
      operationInFlight.current = false
      setReading(false)
    }
  }

  async function saveAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || !draft || operationInFlight.current) return
    const error = validateAssessment(assessment, draft.ownershipProof)
    if (error) { setReviewError(error); return }
    operationInFlight.current = true
    setSaving(true)
    setReviewError("")
    setSaved(false)
    try {
      const result = await donationRequest<{ donation: DonationRecord }>(`/api/donations/${selected.id}`, {
        method: "PATCH", body: JSON.stringify({ assessment, reviewedAt: selected.reviewedAt }),
      })
      setSelected(result.donation)
      setAssessment(result.donation.assessment ?? INITIAL_ASSESSMENT)
      setSaved(true)
      toast.success("Assessment saved. The student can see the updated outcome.")
      void mutate(isDonationListKey).catch(() => undefined)
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Could not save your assessment. Please try again.")
    } finally {
      operationInFlight.current = false
      setSaving(false)
    }
  }

  function change<K extends keyof DonationAssessment>(key: K, value: DonationAssessment[K]) {
    setAssessment((previous) => ({ ...previous, [key]: value }))
    setReviewError("")
    setExported(false)
    setSaved(false)
  }

  async function openDraft(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || operationInFlight.current) return
    operationInFlight.current = true
    setSelected(null)
    setSaved(false)
    setReading(true)
    setImportError("")
    setDraft(null)
    setAssessment(INITIAL_ASSESSMENT)
    setReviewError("")
    setExported(false)
    try {
      if (file.size > MAX_DONATION_FILE_BYTES) throw new Error("Choose a donation draft up to 3 MB, including ownership proof.")
      setDraft(parseDonationDraft(await file.text()))
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Could not open the draft. Please try again.")
    } finally {
      operationInFlight.current = false
      setReading(false)
    }
  }

  function exportAssessment(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    if (!draft || saving) return
    const error = validateAssessment(assessment, draft.ownershipProof)
    if (error) { setReviewError(error); return }
    try {
      downloadDonationDocument({
        kind: "cyclenet-donation-assessment", version: 2, assessedAt: new Date().toISOString(),
        draft, assessment: { ...assessment, notes: assessment.notes.trim(), ownershipNotes: assessment.ownershipNotes.trim() },
        fleetRegistrationCompleted: false,
      }, "cyclenet-donation-assessment.json")
      setExported(true)
      toast.success("Assessment downloaded. No donation status or fleet records were changed.")
    } catch {
      setReviewError("Could not download the assessment. Please try again.")
    }
  }

  return (
    <div className="flex flex-col gap-5 font-sans">
      <DonationDraftNotice admin />
      <DonationInbox admin busy={reading || saving} selectedId={selected?.id} onOpen={(id) => void openRequest(id)} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileJsonIcon aria-hidden="true" />Open an offline backup (optional)</CardTitle>
          <CardDescription>For online submissions, open a request from the inbox above. Imported JSON backups can be inspected but cannot update an online request.</CardDescription>
        </CardHeader>
        <CardContent>
          <Field data-invalid={Boolean(importError)}>
            <FieldLabel htmlFor="donation-file">Student donation draft</FieldLabel>
            <Input id="donation-file" type="file" accept=".json,application/json" disabled={reading || saving} onChange={openDraft} aria-invalid={Boolean(importError)} aria-describedby={importError ? "donation-file-error" : "donation-file-help"} />
            <FieldDescription id="donation-file-help">JSON only, up to 3 MB including the ownership document. Read on this device, not uploaded. Imported names and contact details do not verify the student&apos;s identity.</FieldDescription>
            {importError && <FieldError id="donation-file-error">{importError}</FieldError>}
            {reading && <p role="status" className="text-sm text-muted-foreground">Opening draft…</p>}
          </Field>
        </CardContent>
      </Card>
      {!draft ? (
        <Card>
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><ClipboardCheckIcon /></EmptyMedia>
                <EmptyTitle>No donation selected</EmptyTitle>
                <EmptyDescription>Open a submitted request from the inbox to inspect ownership evidence and save an assessment, or import an offline backup for inspection only.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <DonationDetailsCard draft={draft} record={selected} />
          <form noValidate onSubmit={selected ? saveAssessment : exportAssessment} className="min-w-0" aria-busy={saving}>
            <fieldset disabled={saving || reading} className="min-w-0">
            <Card>
              <CardHeader>
                <CardTitle>Inspection & recommendation</CardTitle>
                <CardDescription>{selected ? "Save the assessment to update this request. The student can see your outcome and assessment notes. Verify ownership before acceptance." : "Offline backup: this assessment can only be downloaded. Verify ownership and contact details with the student before accepting the cycle."}</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <FieldSet>
                    <FieldLegend variant="label">Recommended next step</FieldLegend>
                    <FieldGroup>
                      {DONATION_OUTCOMES.map((outcome) => (
                        <Field key={outcome.value} orientation="horizontal" className="rounded-lg border p-3">
                          <input id={`outcome-${outcome.value}`} name="donation-outcome" type="radio" value={outcome.value} checked={assessment.outcome === outcome.value} onChange={() => change("outcome", outcome.value)} className="mt-1 size-4 shrink-0 accent-primary" aria-describedby={`outcome-${outcome.value}-help`} />
                          <FieldContent>
                            <FieldLabel htmlFor={`outcome-${outcome.value}`}>{outcome.label}</FieldLabel>
                            <FieldDescription id={`outcome-${outcome.value}-help`}>{outcome.description}</FieldDescription>
                          </FieldContent>
                        </Field>
                      ))}
                    </FieldGroup>
                  </FieldSet>
                  <FieldSet>
                    <FieldLegend variant="label">Ownership verification — required before acceptance</FieldLegend>
                    <FieldDescription>Download and inspect the attached document. Match the student ID to the owner and the bicycle to its model and frame number where available. If names differ, check evidence of the ownership transfer. Do not recommend acceptance while ownership is uncertain.</FieldDescription>
                    <Field orientation="horizontal" data-disabled={!draft.ownershipProof}>
                      <input id="donation-ownership-verified" type="checkbox" disabled={!draft.ownershipProof} checked={assessment.ownershipVerified} onChange={(event) => change("ownershipVerified", event.target.checked)} className="mt-1 size-4 shrink-0 accent-primary" aria-describedby="donation-ownership-review-help" />
                      <FieldContent>
                        <FieldLabel htmlFor="donation-ownership-verified">I checked the document, student identity and bicycle; ownership is verified.</FieldLabel>
                        <FieldDescription id="donation-ownership-review-help">Required for fleet, repair and spare-parts recommendations. A file attachment or self-declaration alone is not verification.</FieldDescription>
                      </FieldContent>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="donation-ownership-notes">Ownership verification notes</FieldLabel>
                      <Textarea id="donation-ownership-notes" maxLength={1000} rows={3} value={assessment.ownershipNotes} onChange={(event) => change("ownershipNotes", event.target.value)} placeholder="Record the evidence checked, student identity match, bicycle identifiers, and any ownership transfer." />
                      <FieldDescription>Required unless declining. Record findings, not copies of student-ID or payment numbers.</FieldDescription>
                    </Field>
                  </FieldSet>
                  <FieldSet>
                    <FieldLegend variant="label">Handover & safety checks</FieldLegend>
                    <Field orientation="horizontal">
                      <input id="donation-received" type="checkbox" checked={assessment.received} onChange={(event) => change("received", event.target.checked)} className="size-4 shrink-0 accent-primary" />
                      <FieldLabel htmlFor="donation-received">Cycle physically received</FieldLabel>
                    </Field>
                    <Field orientation="horizontal">
                      <input id="donation-safety" type="checkbox" checked={assessment.safetyChecked} onChange={(event) => change("safetyChecked", event.target.checked)} className="size-4 shrink-0 accent-primary" />
                      <FieldLabel htmlFor="donation-safety">Brakes, tyres, steering, frame & chain pass inspection</FieldLabel>
                    </Field>
                    <FieldDescription>Both checks are required for a fleet-ready recommendation.</FieldDescription>
                  </FieldSet>
                  <Field>
                    <FieldLabel htmlFor="donation-review-notes">Assessment notes</FieldLabel>
                    <Textarea id="donation-review-notes" rows={4} maxLength={2000} value={assessment.notes} onChange={(event) => change("notes", event.target.value)} placeholder="Inspection findings, required repairs, reusable parts, or reason for declining." />
                  </Field>
                  {reviewError && <FieldError role="alert">{reviewError}</FieldError>}
                </FieldGroup>
              </CardContent>
              <CardFooter className="flex flex-col items-stretch gap-3">
                {selected ? <>
                  <Button type="submit" disabled={saving || saved}><SaveIcon data-icon="inline-start" />{saving ? "Saving…" : saved ? "Assessment saved" : "Save assessment"}</Button>
                  <Button type="button" variant="outline" onClick={() => exportAssessment()}><DownloadIcon data-icon="inline-start" />Download assessment backup</Button>
                </> : <Button type="submit"><DownloadIcon data-icon="inline-start" />Download assessment</Button>}
                <p id="donation-fleet-note" className="text-sm leading-relaxed text-muted-foreground">A saved assessment updates the donation request only. Fleet registration, parts inventory and email notifications are not automatic. No changes are made to existing bicycles.</p>
                {saved && <p role="status" className="text-sm text-primary">Assessment saved online. The student can now see this outcome and your assessment notes.</p>}
                {exported && <p role="status" className="text-sm text-muted-foreground">Assessment backup downloaded. Downloading does not save changes online.</p>}
              </CardFooter>
            </Card>
            </fieldset>
          </form>
        </div>
      )}
    </div>
  )
}

function DonationDetailsCard({ draft, record }: { draft: DonationDraft; record: DonationRecord | null }) {
  const details = draft.details
  const rows = [
    ["Student", details.donorName], ["College email", details.donorEmail], ["Department", details.department || "Not provided"],
    ["Contact phone", details.phone || "Not provided"], ["Year of study", DONOR_YEARS.find((year) => year.value === details.studyYear)?.label ?? details.studyYear],
    ["Graduation year", details.graduationYear], ["Brand / model", `${details.brand} · ${details.model}`], ["Colour", details.colour],
    ["Frame number", details.frameNumber || "Not provided"], ["Condition", DONATION_CONDITIONS.find((condition) => condition.value === details.condition)?.label ?? details.condition],
    ["Proposed handover", `${details.handoverDate} · ${details.handoverLocation}`], ["Known issues / parts", details.knownIssues || "None reported by the student"],
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle>Student donation details</CardTitle>
        <CardDescription>{record ? `Submitted ${new Date(record.createdAt).toLocaleDateString("en-IN")} · Reference: ${record.id}` : "Self-reported details from an offline file. Inspect the cycle before deciding its next step."}</CardDescription>
        <Badge variant="outline" className="w-fit">{record ? donationStatus(record.assessment) : "Offline draft · not submitted"}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <dl className="flex flex-col gap-4">
          {rows.map(([label, value]) => <div key={label} className="flex flex-col gap-1"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap break-words text-sm leading-relaxed">{value}</dd></div>)}
        </dl>
        <Alert>
          <ClipboardCheckIcon />
          <AlertTitle>{draft.ownershipProof ? "Document attached — not yet verified" : "Ownership proof missing — do not accept"}</AlertTitle>
          <AlertDescription>{draft.ownershipProof ? "Check the document against the student and physical bicycle. Imported documents can be altered; an attachment is not a guarantee of authenticity." : "This older draft contains only an ownership declaration. Ask the student to download a new draft with proof. Acceptance recommendations are blocked."}</AlertDescription>
        </Alert>
        {draft.ownershipProof && (
          <div className="flex min-w-0 flex-col gap-3">
            <dl className="flex flex-col gap-3">
              <div className="flex flex-col gap-1"><dt className="text-sm text-muted-foreground">Ownership document</dt><dd className="break-words text-sm">{draft.ownershipProof.filename}</dd></div>
              <div className="flex flex-col gap-1"><dt className="text-sm text-muted-foreground">Owner / purchaser name (self-reported)</dt><dd className="break-words text-sm">{draft.ownershipProof.ownerName}</dd></div>
              {draft.ownershipProof.explanation && <div className="flex flex-col gap-1"><dt className="text-sm text-muted-foreground">Ownership explanation</dt><dd className="whitespace-pre-wrap break-words text-sm leading-relaxed">{draft.ownershipProof.explanation}</dd></div>}
            </dl>
            <Button type="button" variant="outline" onClick={() => {
              try { downloadOwnershipProof(draft.ownershipProof!) } catch { toast.error("Could not download the ownership document.") }
            }}><DownloadIcon data-icon="inline-start" />Download ownership document</Button>
            <p className="text-sm leading-relaxed text-muted-foreground">Contains personal information. Use a trusted document viewer; files are not malware-scanned or automatically authenticated.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
