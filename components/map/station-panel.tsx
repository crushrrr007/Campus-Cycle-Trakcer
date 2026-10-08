"use client"

import { useState } from "react"
import { Bike as BikeIcon, MapPin, Navigation, Save, Wrench, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { StationStatusBadge } from "@/components/status-badge"
import { useStore, type StationStats } from "@/lib/store"
import { toast } from "sonner"
import { BikeFrameBadge, StationFrameAvailability } from "@/components/bike-frame-info"

export function StationPanel({
  station,
  editing = false,
  lowFrameOnly = false,
  onClose,
}: {
  station: StationStats
  editing?: boolean
  lowFrameOnly?: boolean
  onClose: () => void
}) {
  const { bikes, role, borrowBike, updateStation, myActiveRide } = useStore()
  const atStation = bikes.filter((b) => b.stationId === station.id)
  const available = atStation.filter((b) => b.status === "available")
  const maintenance = atStation.filter((b) => b.status === "maintenance")
  const visibleBikes = lowFrameOnly ? available.filter((bike) => bike.frameType === "step-through") : atStation

  async function handleBorrow(bikeId: string) {
    const res = await borrowBike(bikeId)
    if (res.ok) toast.success(res.message)
    else toast.error(res.message)
  }

  if (editing && role === "admin") {
    return (
      <StationEditForm
        key={station.id}
        station={station}
        onClose={onClose}
        onSave={(id, data) => updateStation(id, data)}
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-primary" />
            <h2 className="text-base font-semibold">{station.name}</h2>
          </div>
          <p className="text-sm text-muted-foreground">{station.zone} zone</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close panel">
          <X />
        </Button>
      </div>
      <Separator />

      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <StationStatusBadge status={station.status} />
          <span className="text-sm text-muted-foreground">
            {station.available} of {station.capacity} available
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Dock utilization</span>
            <span className="font-mono">{station.utilization}%</span>
          </div>
          <Progress value={station.utilization} />
        </div>

        <StationFrameAvailability station={station} admin={role === "admin"} />
        <p className="text-sm leading-relaxed text-muted-foreground">
          Step-through / low-frame bikes are easier to mount. Anyone can use them; check saddle height and fit before borrowing.
        </p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Available" value={available.length} />
          <Stat label="In service" value={maintenance.length} />
          <Stat label="Capacity" value={station.capacity} />
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-sm font-medium">{lowFrameOnly ? "Available low-frame bicycles" : "Bicycles at this station"}</h3>
        <span className="text-sm text-muted-foreground">{visibleBikes.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {visibleBikes.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {lowFrameOnly ? "No verified low-frame bicycles available here right now. Choose another station or show all bikes." : "No bicycles docked here right now."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visibleBikes.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-md bg-muted">
                    {b.status === "maintenance" ? (
                      <Wrench className="size-4 text-muted-foreground" />
                    ) : (
                      <BikeIcon className="size-4 text-primary" />
                    )}
                  </span>
                  <div className="flex flex-col">
                    <span className="font-mono text-sm font-medium">{b.id}</span>
                    <span className="text-sm text-muted-foreground">{b.model}</span>
                    <BikeFrameBadge frameType={b.frameType} />
                  </div>
                </div>
                {role === "student" && b.status === "available" && (
                  <Button
                    size="sm"
                    onClick={() => handleBorrow(b.id)}
                    disabled={!!myActiveRide}
                  >
                    <Navigation data-icon="inline-start" />
                    Borrow
                  </Button>
                )}
                {b.status === "maintenance" && (
                  <span className="text-xs text-muted-foreground">Servicing</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
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
