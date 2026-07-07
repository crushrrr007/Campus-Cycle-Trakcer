"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useStore, type StationStats } from "@/lib/store"

const LocationPickerMap = dynamic(() => import("./location-picker-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
})

const DEFAULT_ZONES = ["Academic", "Residential", "Amenity", "Entrance", "Transit Hub", "Sports"]

interface StationFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided the dialog edits this station, otherwise it creates a new one */
  station?: StationStats | null
}

export function StationFormDialog({ open, onOpenChange, station }: StationFormDialogProps) {
  const { stations, addStation, updateStation } = useStore()
  const isEdit = Boolean(station)

  const [name, setName] = useState("")
  const [shortName, setShortName] = useState("")
  const [zone, setZone] = useState("Academic")
  const [capacity, setCapacity] = useState(20)
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const zones = useMemo(() => {
    const existing = new Set([...DEFAULT_ZONES, ...stations.map((s) => s.zone)])
    return Array.from(existing).sort()
  }, [stations])

  // Sync form state each time the dialog opens
  useEffect(() => {
    if (!open) return
    setName(station?.name ?? "")
    setShortName(station?.shortName ?? "")
    setZone(station?.zone ?? "Academic")
    setCapacity(station?.capacity ?? 20)
    setLat(station?.lat ?? null)
    setLng(station?.lng ?? null)
  }, [open, station])

  async function handleSubmit() {
    const trimmedName = name.trim()
    const trimmedShort = shortName.trim() || trimmedName
    if (!trimmedName) {
      toast.error("Please give the station a name.")
      return
    }
    if (capacity < 1) {
      toast.error("Capacity must be at least 1 dock.")
      return
    }
    if (lat == null || lng == null) {
      toast.error("Pick the station location by clicking on the map.")
      return
    }

    setSaving(true)
    const res =
      isEdit && station
        ? await updateStation(station.id, {
            name: trimmedName,
            shortName: trimmedShort,
            zone,
            capacity,
            lat,
            lng,
          })
        : await addStation({ name: trimmedName, shortName: trimmedShort, zone, capacity, lat, lng })
    setSaving(false)

    if (!res.ok) {
      toast.error(res.message)
      return
    }
    toast.success(isEdit ? `${trimmedName} updated.` : `${trimmedName} is now live with ${capacity} docks.`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${station?.shortName}` : "Add station"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the station details or drag the pin to move it."
              : "Fill in the details, then click the map to place the station."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="station-name">Name</Label>
              <Input
                id="station-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sports Complex Station"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="station-short">Short name</Label>
              <Input
                id="station-short"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder="e.g. Sports Complex"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="station-zone">Zone</Label>
              <Select value={zone} onValueChange={(v) => v && setZone(v)}>
                <SelectTrigger id="station-zone" className="w-full">
                  <SelectValue placeholder="Select zone" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((z) => (
                    <SelectItem key={z} value={z}>
                      {z}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="station-capacity">Capacity (docks)</Label>
              <Input
                id="station-capacity"
                type="number"
                min={1}
                max={100}
                value={capacity}
                onChange={(e) => setCapacity(Math.max(0, Number.parseInt(e.target.value || "0", 10)))}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Location</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {lat != null && lng != null
                  ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
                  : "Click the map to place the pin"}
              </span>
            </div>
            <div className="h-56 overflow-hidden rounded-md border">
              <LocationPickerMap lat={lat} lng={lng} onChange={(la, ln) => (setLat(la), setLng(ln))} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add station"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
