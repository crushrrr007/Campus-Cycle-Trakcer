"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Pencil, QrCode, Trash2, Wrench } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

const SERVICE_TYPES = ["Tune-up", "Brake adjustment", "Tire replacement", "Chain service", "Other"]

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`
  const months = Math.floor(days / 30)
  return `${months} month${months === 1 ? "" : "s"} ago`
}

const STATUS_STYLES: Record<string, string> = {
  available: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "in-use": "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  maintenance: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
}

interface BikeDetailSheetProps {
  bikeId: string | null
  onClose: () => void
  onEdit: (bikeId: string) => void
}

export function BikeDetailSheet({ bikeId, onClose, onEdit }: BikeDetailSheetProps) {
  const { bikes, rides, deleteBike, toggleMaintenance, logService, stationName } = useStore()
  const bike = useMemo(() => bikes.find((b) => b.id === bikeId) ?? null, [bikes, bikeId])

  const bikeRides = useMemo(
    () => (bike ? rides.filter((r) => r.bikeId === bike.id) : []),
    [rides, bike],
  )

  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0])
  const [serviceNotes, setServiceNotes] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)

  function handleLogService() {
    if (!bike) return
    logService(bike.id, serviceType, serviceNotes.trim() || "Routine service")
    setServiceNotes("")
    toast.success(`${serviceType} logged for ${bike.id}.`)
  }

  async function handleDelete() {
    if (!bike) return
    const res = await deleteBike(bike.id)
    if (res.ok) {
      toast.success(res.message)
      onClose()
    } else {
      toast.error(res.message)
    }
    setConfirmDelete(false)
  }

  return (
    <>
      <Sheet open={Boolean(bike)} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {bike && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <SheetTitle className="font-mono">{bike.id}</SheetTitle>
                  <Badge className={cn("capitalize", STATUS_STYLES[bike.status])} variant="secondary">
                    {bike.status === "in-use" ? "In use" : bike.status}
                  </Badge>
                </div>
                <SheetDescription className="flex items-center gap-1.5">
                  <QrCode className="size-3.5" aria-hidden />
                  <span className="font-mono text-xs">{bike.qr}</span>
                </SheetDescription>
              </SheetHeader>

              <div className="grid gap-4 px-4 pb-6">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Model</p>
                    <p className="text-sm font-medium">{bike.model}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="text-sm font-medium">
                      {bike.status === "in-use" ? "On a ride" : stationName(bike.stationId)}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Total rides</p>
                    <p className="text-sm font-medium tabular-nums">{bike.usageCount}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Last serviced</p>
                    <p className="text-sm font-medium">{timeAgo(bike.lastServiceDate)}</p>
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Condition</p>
                    <p className="text-xs font-medium tabular-nums">{bike.condition}%</p>
                  </div>
                  <Progress value={bike.condition} aria-label={`Condition ${bike.condition}%`} />
                </div>

                {/* Quick actions */}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => onEdit(bike.id)}>
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bike.status === "in-use"}
                    onClick={() => {
                      toggleMaintenance(bike.id)
                      toast.success(
                        bike.status === "maintenance"
                          ? `${bike.id} returned to service.`
                          : `${bike.id} sent to maintenance.`,
                      )
                    }}
                  >
                    <Wrench className="size-3.5" />
                    {bike.status === "maintenance" ? "Return to service" : "Send to maintenance"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    disabled={bike.status === "in-use"}
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </Button>
                </div>

                <Separator />

                {/* Log service */}
                <div className="grid gap-2">
                  <Label className="text-sm font-semibold">Log service</Label>
                  <div className="flex gap-2">
                    <Select value={serviceType} onValueChange={(v) => v && setServiceType(v)}>
                      <SelectTrigger className="flex-1" aria-label="Service type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SERVICE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" className="h-9" onClick={handleLogService}>
                      Log
                    </Button>
                  </div>
                  <Textarea
                    value={serviceNotes}
                    onChange={(e) => setServiceNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    rows={2}
                  />
                </div>

                <Separator />

                {/* Service history */}
                <div className="grid gap-2">
                  <p className="text-sm font-semibold">
                    Service history{" "}
                    <span className="font-normal text-muted-foreground">
                      ({bike.serviceHistory.length})
                    </span>
                  </p>
                  {bike.serviceHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No service records yet.</p>
                  ) : (
                    <ul className="grid gap-2">
                      {bike.serviceHistory.map((rec) => (
                        <li key={rec.id} className="rounded-md border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">{rec.type}</p>
                            <p className="text-xs text-muted-foreground">{timeAgo(rec.date)}</p>
                          </div>
                          {rec.notes && (
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                              {rec.notes}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Recent rides */}
                {bikeRides.length > 0 && (
                  <>
                    <Separator />
                    <div className="grid gap-2">
                      <p className="text-sm font-semibold">
                        Recent rides{" "}
                        <span className="font-normal text-muted-foreground">
                          ({bikeRides.length})
                        </span>
                      </p>
                      <ul className="grid gap-2">
                        {bikeRides.slice(0, 5).map((r) => (
                          <li key={r.id} className="rounded-md border p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium">{r.userName}</p>
                              <p className="text-xs text-muted-foreground">{timeAgo(r.borrowTime)}</p>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {stationName(r.sourceStationId)} →{" "}
                              {r.destStationId ? stationName(r.destStationId) : "in progress"}
                              {r.durationMin != null && ` · ${r.durationMin} min`}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {bike?.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the bicycle and its service history from the fleet. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
