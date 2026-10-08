"use client"

import { useState, type ChangeEvent, type FormEvent } from "react"
import { ClipboardCheckIcon, DownloadIcon, FileJsonIcon } from "lucide-react"
import { toast } from "sonner"
import { DONATION_CONDITIONS, DONATION_OUTCOMES, DONOR_YEARS, MAX_DONATION_FILE_BYTES, downloadDonationDocument, parseDonationDraft, validateAssessment, type DonationAssessment, type DonationDraft } from "@/lib/donations"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { DonationDraftNotice } from "./donation-guidance"

const INITIAL_ASSESSMENT: DonationAssessment = { outcome: "repair", notes: "", received: false, safetyChecked: false }

export function AdminDonationsView() {
  const [draft, setDraft] = useState<DonationDraft | null>(null)
  const [assessment, setAssessment] = useState<DonationAssessment>(INITIAL_ASSESSMENT)
  const [importError, setImportError] = useState("")
  const [reviewError, setReviewError] = useState("")
  const [reading, setReading] = useState(false)
  const [exported, setExported] = useState(false)

  function change<K extends keyof DonationAssessment>(key: K, value: DonationAssessment[K]) {
    setAssessment((previous) => ({ ...previous, [key]: value }))
    setReviewError("")
    setExported(false)
  }

  async function openDraft(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setReading(true)
    setImportError("")
    setDraft(null)
    setAssessment(INITIAL_ASSESSMENT)
    setReviewError("")
    setExported(false)
    try {
      if (file.size > MAX_DONATION_FILE_BYTES) throw new Error("Choose a donation draft smaller than 64 KB.")
      setDraft(parseDonationDraft(await file.text()))
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Could not open the draft. Please try again.")
    } finally {
      setReading(false)
    }
  }

  function exportAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft) return
    const error = validateAssessment(assessment)
    if (error) { setReviewError(error); return }
    try {
      downloadDonationDocument({
        kind: "cyclenet-donation-assessment", version: 1, assessedAt: new Date().toISOString(),
        draft, assessment: { ...assessment, notes: assessment.notes.trim() },
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileJsonIcon aria-hidden="true" />Open a donation draft</CardTitle>
          <CardDescription>Ask the student for the JSON file downloaded from Donate a Cycle. There is no shared submission inbox in draft-only mode.</CardDescription>
        </CardHeader>
        <CardContent>
          <Field data-invalid={Boolean(importError)}>
            <FieldLabel htmlFor="donation-file">Student donation draft</FieldLabel>
            <Input id="donation-file" type="file" accept=".json,application/json" disabled={reading} onChange={openDraft} aria-invalid={Boolean(importError)} aria-describedby={importError ? "donation-file-error" : "donation-file-help"} />
            <FieldDescription id="donation-file-help">JSON only, up to 64 KB. Read on this device, not uploaded. Contact details in imported files are not verified account identities.</FieldDescription>
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
                <EmptyTitle>No draft open</EmptyTitle>
                <EmptyDescription>Open a student draft to inspect the cycle details and recommend fleet use, repairs, spare-part recovery, or declining the donation.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <DonationDetailsCard draft={draft} />
          <form noValidate onSubmit={exportAssessment} className="min-w-0">
            <Card>
              <CardHeader>
                <CardTitle>Inspection & recommendation</CardTitle>
                <CardDescription>This assessment is a downloaded record only. Verify ownership and contact details with the student before accepting the cycle.</CardDescription>
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
                    <FieldLegend variant="label">Handover & safety checks</FieldLegend>
                    <Field orientation="horizontal">
                      <input id="donation-received" type="checkbox" checked={assessment.received} onChange={(event) => change("received", event.target.checked)} className="size-4 shrink-0 accent-primary" />
                      <FieldLabel htmlFor="donation-received">Cycle physically received; ownership verified</FieldLabel>
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
                  {reviewError && <FieldError>{reviewError}</FieldError>}
                </FieldGroup>
              </CardContent>
              <CardFooter className="flex flex-col items-stretch gap-3">
                <Button type="submit"><DownloadIcon data-icon="inline-start" />Download assessment</Button>
                <Button type="button" variant="outline" disabled aria-describedby="donation-fleet-note">Register in fleet — unavailable</Button>
                <p id="donation-fleet-note" className="text-sm leading-relaxed text-muted-foreground">Donation status, parts inventory, notifications, and linked fleet registration need database setup. No changes are made to existing bicycles.</p>
                {exported && <p role="status" className="text-sm text-primary">Assessment downloaded. Keep this file — no review has been saved online.</p>}
              </CardFooter>
            </Card>
          </form>
        </div>
      )}
    </div>
  )
}

function DonationDetailsCard({ draft }: { draft: DonationDraft }) {
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
        <CardDescription>Self-reported details from the file. Inspect the cycle before deciding its next step.</CardDescription>
        <Badge variant="outline" className="w-fit">Unverified draft · not submitted</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <dl className="flex flex-col gap-4">
          {rows.map(([label, value]) => <div key={label} className="flex flex-col gap-1"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap break-words text-sm leading-relaxed">{value}</dd></div>)}
        </dl>
        <Alert>
          <ClipboardCheckIcon />
          <AlertTitle>Ownership declared, not verified</AlertTitle>
          <AlertDescription>The donor confirmed ownership in their draft. Confirm this separately at handover.</AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
