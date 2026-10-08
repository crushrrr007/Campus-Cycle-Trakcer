"use client"

import { type ChangeEvent } from "react"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { readOwnershipProof, type DonationOwnershipProof } from "@/lib/donations"

export function OwnershipProofField({ proof, error, reading, onChange, onError, onReading }: {
  proof: DonationOwnershipProof | null
  error: string
  reading: boolean
  onChange: (proof: DonationOwnershipProof | null) => void
  onError: (message: string) => void
  onReading: (reading: boolean) => void
}) {
  async function attach(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    onChange(null)
    onError("")
    onReading(true)
    try {
      const attachment = await readOwnershipProof(file)
      onChange({ ...attachment, ownerName: proof?.ownerName ?? "", explanation: proof?.explanation ?? "" })
    } catch (cause) {
      input.value = ""
      onError(cause instanceof Error ? cause.message : "Could not read the ownership document. Try again.")
    } finally {
      onReading(false)
    }
  }

  return (
    <FieldSet>
      <FieldLegend>Proof of ownership</FieldLegend>
      <FieldDescription>Attach an invoice, purchase receipt, or signed ownership-transfer document identifying this bicycle. The transport team must check it against you and the cycle before acceptance.</FieldDescription>
      <FieldGroup>
        <Field data-invalid={Boolean(error)} data-disabled={reading}>
          <FieldLabel htmlFor="donation-proof-file">Invoice / ownership document (required)</FieldLabel>
          <Input id="donation-proof-file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={reading} onChange={attach} aria-invalid={Boolean(error)} aria-describedby={`donation-proof-help${error ? " donation-proof-error" : ""}`} />
          <FieldDescription id="donation-proof-help">PDF, JPG or PNG, up to 2 MB. Saved privately when you submit; also included in downloaded backups. Redact payment details and unrelated personal information; keep the owner name and bicycle identifiers visible.</FieldDescription>
          {error && <FieldError id="donation-proof-error">{error}</FieldError>}
          {reading && <p role="status" className="text-sm text-muted-foreground">Reading ownership document…</p>}
          {proof && <p role="status" className="break-words text-sm text-muted-foreground">Attached: {proof.filename} · {Math.ceil(proof.sizeBytes / 1024)} KB · not verified</p>}
        </Field>
        {proof && (
          <>
            <Field>
              <FieldLabel htmlFor="donation-proof-owner">Owner / purchaser name on the document (required)</FieldLabel>
              <Input id="donation-proof-owner" maxLength={100} value={proof.ownerName} onChange={(event) => onChange({ ...proof, ownerName: event.target.value })} required aria-invalid={Boolean(error && !proof.ownerName.trim())} aria-describedby={error ? "donation-proof-error" : undefined} />
            </Field>
            <Field>
              <FieldLabel htmlFor="donation-proof-explanation">Ownership explanation (optional)</FieldLabel>
              <Textarea id="donation-proof-explanation" maxLength={1000} rows={3} value={proof.explanation} onChange={(event) => onChange({ ...proof, explanation: event.target.value })} placeholder="If the invoice is in a parent's or previous owner's name, explain the transfer to you. Bring supporting evidence for the team to check." />
              <FieldDescription>No document? Contact the transport team to agree on acceptable evidence. A self-declaration or bicycle photo alone is not proof of ownership.</FieldDescription>
            </Field>
          </>
        )}
      </FieldGroup>
    </FieldSet>
  )
}
