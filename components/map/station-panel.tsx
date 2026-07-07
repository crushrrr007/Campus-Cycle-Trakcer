"use client"

import { useEffect, useState } from "react"
import { Bike as BikeIcon, MapPin, Navigation, Save, Wrench, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { StationStatusBadge } from "@/components/status-badge"
import { useStore, type StationStats } from "@/lib/store"
import { toast } from "sonner"

export function StationPanel({
  station,
  editing = false,
  onClose,
}: {
  station: StationStats
  editing?: boolean
  onClose: () => void
}) {
  const { bikes, role, borrowBike, updateStation, myActiveRide } = useStore()
  const atStation = bikes.filter((b) => b.stationId === station.id)
  const available = atStation.filter((b) => b.status === "available")
  const maintenance = atStation.filter((b) => b.status === "maintenance")

  async function handleBorrow(bikeId: string) {
    const res = await borrowBike(bikeId)
    if (res.ok) toast.success(res.message)
    else toast.error(res.message)
  }

  if (editing && role === "admin") {
    return (
      <StationEditForm
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

        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Available" value={available.length} />
          <Stat label="In service" value={maintenance.length} />
          <Stat label="Capacity" value={station.capacity} />
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-sm font-medium">Bicycles at this station</h3>
        <span className="text-xs text-muted-foreground">{atStation.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {atStation.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No bicycles docked here right now.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {atStation.map((b) => (
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
                    <span className="text-xs text-muted-foreground">{b.model}</span>
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
  onSave: (id: string, data: Partial<StationStats>) => void
}) {
  const [name, setName] = useState(station.name)
  const [shortName, setShortName] = useState(station.shortName)
  const [zone, setZone] = useState(station.zone)
  const [capacity, setCapacity] = useState(String(station.capacity))

  // Keep form in sync if a different station is selected while editing.
  useEffect(() => {
    setName(station.name)
    setShortName(station.shortName)
    setZone(station.zone)
    setCapacity(String(station.capacity))
  }, [station.id, station.name, station.shortName, station.zone, station.capacity])

  function handleSave() {
    const cap = Math.max(0, Number.parseInt(capacity, 10) || 0)
    onSave(station.id, { name: name.trim(), shortName: shortName.trim(), zone: zone.trim(), capacity: cap })
    toast.success("Station updated", { description: `${shortName.trim()} details saved.` })
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
        <Button className="flex-1" onClick={handleSave}>
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
