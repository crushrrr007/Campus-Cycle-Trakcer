"use client"

import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function DonationSelect({ id, label, value, items, onChange, error }: {
  id: string
  label: string
  value: string
  items: readonly { value: string; label: string }[]
  onChange: (value: string) => void
  error?: string
}) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={value} onValueChange={(next) => next && onChange(next)} items={[...items]}>
        <SelectTrigger id={id} className="w-full" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}><SelectValue /></SelectTrigger>
        <SelectContent><SelectGroup>{items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectGroup></SelectContent>
      </Select>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  )
}
