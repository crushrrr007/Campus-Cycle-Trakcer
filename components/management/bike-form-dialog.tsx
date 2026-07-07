"use client"

import { useEffect, useMemo, useState } from "react"
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
import { Slider } from "@/components/ui/slider"
import { useStore } from "@/lib/store"
import type { Bike } from "@/lib/types"

const DEFAULT_MODELS = ["NITT Cruiser", "NITT Sprinter", "NITT Commuter"]
const CUSTOM_MODEL = "__custom__"

interface BikeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided the dialog edits this bike, otherwise it registers a new one */
  bike?: Bike | null
}

export function BikeFormDialog({ open, onOpenChange, bike }: BikeFormDialogProps) {
  const { bikes, stations, addBike, updateBike } = useStore()
  const isEdit = Boolean(bike)

  const models = useMemo(() => {
    const set = new Set([...DEFAULT_MODELS, ...bikes.map((b) => b.model)])
    return Array.from(set).sort()
  }, [bikes])

  const [model, setModel] = useState(DEFAULT_MODELS[0])
  const [customModel, setCustomModel] = useState("")
  const [stationId, setStationId] = useState<string>("")
  const [condition, setCondition] = useState(100)

  // Preview of the next auto-generated bike id
  const nextId = useMemo(() => {
    if (isEdit) return bike?.id ?? ""
    const maxNum = bikes.reduce((max, b) => {
      const n = Number.parseInt(b.id.split("-")[1] ?? "0", 10)
      return Number.isNaN(n) ? max : Math.max(max, n)
    }, 0)
    return `NITT-${String(maxNum + 1).padStart(4, "0")}`
  }, [bikes, bike, isEdit])

  useEffect(() => {
    if (!open) return
    const known = bike && models.includes(bike.model)
    setModel(bike ? (known ? bike.model : CUSTOM_MODEL) : DEFAULT_MODELS[0])
    setCustomModel(bike && !known ? bike.model : "")
    setStationId(bike?.stationId ?? stations[0]?.id ?? "")
    setCondition(bike?.condition ?? 100)
  }, [open, bike, models, stations])

  async function handleSubmit() {
    const finalModel = model === CUSTOM_MODEL ? customModel.trim() : model
    if (!finalModel) {
      toast.error("Please enter a model name.")
      return
    }
    if (!stationId) {
      toast.error("Please choose a home station.")
      return
    }

    if (isEdit && bike) {
      const patch: Parameters<typeof updateBike>[1] = { model: finalModel, condition }
      // Only re-dock if the bike is not currently on a ride
      if (bike.status !== "in-use" && stationId !== bike.stationId) {
        patch.stationId = stationId
      }
      const res = await updateBike(bike.id, patch)
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(`${bike.id} updated.`)
    } else {
      const id = await addBike({ model: finalModel, stationId })
      if (!id) {
        toast.error("Could not register the bicycle. Only admins can add bicycles.")
        return
      }
      toast.success(`${id} registered at ${stations.find((s) => s.id === stationId)?.shortName}.`)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${bike?.id}` : "Register bicycle"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the bicycle details."
              : "Add a new bicycle to the campus fleet. A QR code is generated automatically."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
            <div>
              <p className="text-xs text-muted-foreground">Bicycle ID</p>
              <p className="font-mono text-sm font-semibold">{nextId}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">QR payload</p>
              <p className="font-mono text-xs">NITTBIKE:{nextId}</p>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bike-model">Model</Label>
            <Select value={model} onValueChange={(v) => v && setModel(v)}>
              <SelectTrigger id="bike-model" className="w-full">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_MODEL}>Other (custom)…</SelectItem>
              </SelectContent>
            </Select>
            {model === CUSTOM_MODEL && (
              <Input
                aria-label="Custom model name"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="Enter model name"
              />
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bike-station">Home station</Label>
            <Select
              value={stationId}
              onValueChange={(v) => v && setStationId(v)}
              disabled={isEdit && bike?.status === "in-use"}
            >
              <SelectTrigger id="bike-station" className="w-full">
                <SelectValue placeholder="Select station" />
              </SelectTrigger>
              <SelectContent>
                {stations.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.shortName} ({s.occupied}/{s.capacity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isEdit && bike?.status === "in-use" && (
              <p className="text-xs text-muted-foreground">
                This bicycle is on a ride — its station updates when it&apos;s returned.
              </p>
            )}
          </div>

          {isEdit && (
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="bike-condition">Condition</Label>
                <span className="text-xs tabular-nums text-muted-foreground">{condition}%</span>
              </div>
              <Slider
                id="bike-condition"
                min={0}
                max={100}
                step={5}
                value={[condition]}
                onValueChange={(v) => setCondition((Array.isArray(v) ? v[0] : v) ?? condition)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>{isEdit ? "Save changes" : "Register"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
