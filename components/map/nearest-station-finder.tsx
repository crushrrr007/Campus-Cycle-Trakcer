"use client"

import { LocateFixed, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { StationStats } from "@/lib/store"
import { validCoordinates, type StationPurpose } from "@/lib/station-navigation"

export function NearestStationFinder({ stations, purpose, onPurposeChange, query, onQueryChange, originId, onOriginChange, hasLocation, locating, onLocate, lowFrameOnly, onLowFrameChange, disabled }: {
  stations: StationStats[]
  purpose: StationPurpose
  onPurposeChange: (value: StationPurpose) => void
  query: string
  onQueryChange: (value: string) => void
  originId: string
  onOriginChange: (value: string) => void
  hasLocation: boolean
  locating: boolean
  onLocate: () => void
  lowFrameOnly: boolean
  onLowFrameChange: () => void
  disabled: boolean
}) {
  const origins = [{ value: "none", label: "Choose starting station" }, ...(hasLocation ? [{ value: "gps", label: "My location" }] : []), ...stations.filter(validCoordinates).map((station) => ({ value: station.id, label: station.shortName }))]
  const purposes = [{ value: "borrow", label: "Borrow a bike" }, { value: "return", label: "Return a bike" }]
  return (
    <div className="flex flex-col gap-3">
      <FieldGroup className="flex-row flex-wrap items-end gap-3">
        <Field className="w-40 shrink-0">
          <FieldLabel className="sr-only" htmlFor="station-purpose">I need to</FieldLabel>
          <Select value={purpose} items={purposes} disabled={disabled} onValueChange={(value) => { if (value === "borrow" || value === "return") onPurposeChange(value) }}>
            <SelectTrigger id="station-purpose" className="h-10 w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup>{purposes.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
        </Field>
        <Field className="min-w-48 flex-1">
          <FieldLabel className="sr-only" htmlFor="campus-search">Search campus</FieldLabel>
          <InputGroup className="h-10">
            <InputGroupInput id="campus-search" placeholder="Search hostels, departments, stations…" value={query} onChange={(event) => onQueryChange(event.target.value)} aria-controls="campus-station-results" />
            <InputGroupAddon><Search /></InputGroupAddon>
            {query && <InputGroupAddon align="inline-end"><InputGroupButton aria-label="Clear search" size="icon-xs" onClick={() => onQueryChange("")}><X /></InputGroupButton></InputGroupAddon>}
          </InputGroup>
        </Field>
        <Button variant="outline" className="h-10" disabled={locating || disabled} onClick={onLocate}><LocateFixed data-icon="inline-start" />{locating ? "Locating…" : "Locate me"}</Button>
      </FieldGroup>
      <FieldGroup className="flex-row flex-wrap items-center gap-3">
        <Field orientation="horizontal" className="w-full sm:w-auto">
          <FieldLabel htmlFor="station-origin" className="shrink-0">From</FieldLabel>
          <Select value={originId || "none"} items={origins} disabled={disabled} onValueChange={(value) => { if (value) onOriginChange(value === "none" ? "" : value) }}>
            <SelectTrigger id="station-origin" className="w-full sm:w-52"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup>{origins.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
        </Field>
        <Button variant={lowFrameOnly ? "default" : "outline"} aria-pressed={lowFrameOnly} disabled={disabled || purpose === "return"} onClick={onLowFrameChange}>Low-frame bikes only</Button>
        <span className="text-sm leading-relaxed text-muted-foreground">{purpose === "return" ? "Pins show free docks" : lowFrameOnly ? "Pins show low-frame bikes" : "Pins show available bikes"}</span>
      </FieldGroup>
    </div>
  )
}
