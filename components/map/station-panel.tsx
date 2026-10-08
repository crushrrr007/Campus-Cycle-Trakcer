"use client"

import { useState } from "react"
import Link from "next/link"
import { directionsUrl, distanceMeters, formatDistance, freeDocks, stationAvailability, validCoordinates, type Coordinates, type StationPurpose } from "@/lib/station-navigation"
import { ArrowUpRight, Bike as BikeIcon, MapPin, QrCode, Save, Wrench, X } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { StationStatusBadge } from "@/components/status-badge"
import { useStore, type StationStats } from "@/lib/store"
import { toast } from "sonner"
import { BikeFrameBadge, StationFrameAvailability } from "@/components/bike-frame-info"

export function StationPanel({ station, editing = false, lowFrameOnly = false, purpose = "borrow", origin = null, uncertain = false, recommended = false, compact = false, onClose }: {
  station: StationStats
  editing?: boolean
  lowFrameOnly?: boolean
  purpose?: StationPurpose
  origin?: Coordinates | null
  uncertain?: boolean
  recommended?: boolean
  compact?: boolean
  onClose: () => void
}) {
  const { bikes, role, updateStation, myActiveRide } = useStore()
  const atStation = bikes.filter((bike) => bike.stationId === station.id)
  const visibleBikes = lowFrameOnly ? atStation.filter((bike) => bike.status === "available" && bike.frameType === "step-through") : atStation
  const info = stationAvailability(station, purpose, lowFrameOnly)
  const distance = origin ? distanceMeters(origin, station) : Infinity
  if (editing && role === "admin") return <StationEditForm key={station.id} station={station} onClose={onClose} onSave={(id, data) => updateStation(id, data)} />

  return <div className="flex min-w-0 flex-col">
    <div className="flex items-start justify-between gap-3 p-4">
      <div className="flex min-w-0 flex-col gap-1">
        {recommended && !compact && <p className="text-sm text-muted-foreground">Nearest usable station</p>}
        <h2 className="text-balance text-base font-semibold">{station.name}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{station.zone}{Number.isFinite(distance) ? ` · ${formatDistance(distance)} straight-line` : " zone"}</p>
        <p className={cn("text-base font-semibold", info.usable && !uncertain ? "text-primary" : "text-muted-foreground")}>{uncertain ? "Availability unconfirmed" : `${info.count} ${info.label}${!info.usable ? ` · ${info.reason}` : ""}`}</p>
      </div>
      {!recommended && <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close station details"><X /></Button>}
    </div>
    <div className="flex flex-col gap-3 px-4 pb-4">
      {validCoordinates(station) ? <a href={directionsUrl(station, origin)} target="_blank" rel="noopener noreferrer" className={buttonVariants()}><ArrowUpRight data-icon="inline-start" />Get directions<span className="sr-only"> to {station.name} in Google Maps, opens a new tab</span></a> : <p className="text-sm text-muted-foreground">Directions unavailable: station coordinates need checking.</p>}
      {!compact && <>
        <p className="text-sm leading-relaxed text-muted-foreground">{uncertain ? "Refresh before travelling. Counts cannot be confirmed right now." : !info.usable ? `This station is ${info.reason.toLowerCase()} for your selected journey. Choose another station.` : "Availability may change before you arrive."}</p>
        {role === "student" && info.usable && !uncertain && <Link href="/scan" className={buttonVariants({ variant: "outline" })}><QrCode data-icon="inline-start" />{purpose === "return" ? "Open return flow" : "Scan & Ride on arrival"}</Link>}
        {role === "student" && purpose === "return" && !myActiveRide && <p className="text-sm text-muted-foreground">No active ride to return. You can still plan a drop-off.</p>}
        {!uncertain && <StationFrameAvailability station={station} admin={role === "admin"} />}
        <details className="rounded-lg border" open={role === "admin" ? true : undefined}>
          <summary className="cursor-pointer px-3 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">Bicycle details &amp; station information</summary>
          <div className="flex flex-col gap-4 px-3 pb-3">
            <p className="text-sm leading-relaxed text-muted-foreground">Low-frame bikes are easier to mount and available to anyone. Check saddle height and fit before borrowing. {uncertain ? "The following counts are last-known, not confirmed." : ""}</p>
            {role === "admin" && <><StationStatusBadge status={station.status} /><Progress value={station.utilization} /><div className="grid grid-cols-3 gap-2"><Stat label="Capacity" value={station.capacity} /><Stat label="Free docks" value={freeDocks(station)} /><Stat label="In service" value={atStation.filter((bike) => bike.status === "maintenance").length} /></div></>}
            {visibleBikes.length === 0 ? <p className="text-sm text-muted-foreground">{lowFrameOnly ? "No verified low-frame bikes available here." : "No bicycles docked here."}</p> : <ul className="flex flex-col gap-2">{visibleBikes.map((bike) => <li key={bike.id} className="flex flex-col gap-2 rounded-lg border p-3"><div className="flex items-start gap-2">{bike.status === "maintenance" ? <Wrench className="size-4 shrink-0 text-muted-foreground" /> : <BikeIcon className="size-4 shrink-0 text-primary" />}<div className="flex min-w-0 flex-col"><span className="break-words font-mono text-sm">{bike.id}</span><span className="text-sm text-muted-foreground">{bike.model} · {bike.status === "maintenance" ? "Servicing" : bike.status.replace("-", " ")}</span></div></div><BikeFrameBadge frameType={bike.frameType} /></li>)}</ul>}
          </div>
        </details>
      </>}
    </div>
  </div>
}

function StationEditForm({
  station,
  onClose,
  onSave,
}: {
  station: StationStats
  onClose: () => void
  onSave: (id: string, data: Partial<StationStats>) => Promise<{ ok: boolean; message: string }>
}) {
  const [name, setName] = useState(station.name)
  const [shortName, setShortName] = useState(station.shortName)
  const [zone, setZone] = useState(station.zone)
  const [capacity, setCapacity] = useState(String(station.capacity))

  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const cap = Number(capacity)
    if (!name.trim() || !shortName.trim() || !zone.trim() || !Number.isInteger(cap) || cap < station.occupied) {
      toast.error("Enter valid station details and a capacity that fits its docked bicycles.")
      return
    }
    if (saving) return
    setSaving(true)
    try {
      const result = await onSave(station.id, { name: name.trim(), shortName: shortName.trim(), zone: zone.trim(), capacity: cap })
      if (result.ok) toast.success(result.message)
      else toast.error(result.message)
    } catch {
      toast.error("Unable to save the station. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-primary" />
            <h2 className="text-base font-semibold">Edit station</h2>
          </div>
          <p className="text-sm text-muted-foreground">Update details or drag the marker on the map.</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close panel">
          <X />
        </Button>
      </div>
      <Separator />

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <Field id="stn-name" label="Full name">
          <Input id="stn-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="stn-short" label="Short name">
          <Input id="stn-short" value={shortName} onChange={(e) => setShortName(e.target.value)} />
        </Field>
        <Field id="stn-zone" label="Zone">
          <Input id="stn-zone" value={zone} onChange={(e) => setZone(e.target.value)} />
        </Field>
        <Field id="stn-capacity" label="Capacity (docks)">
          <Input
            id="stn-capacity"
            type="number"
            min={0}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </Field>

        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Coordinates</p>
          <p className="font-mono text-sm">
            {station.lat.toFixed(5)}, {station.lng.toFixed(5)}
          </p>
        </div>
      </div>

      <Separator />
      <div className="flex items-center gap-2 p-4">
        <Button className="flex-1" disabled={saving} onClick={handleSave}>
          <Save data-icon="inline-start" />
          Save changes
        </Button>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-2">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
