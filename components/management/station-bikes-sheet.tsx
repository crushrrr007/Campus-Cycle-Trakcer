"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ArrowRightIcon, BikeIcon, WrenchIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { useStore, type StationStats } from "@/lib/store"
import type { Bike } from "@/lib/types"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<string, string> = {
  available: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  maintenance: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
}

interface StationBikesSheetProps {
  station: StationStats | null
  onClose: () => void
}

/** Admin view: every bicycle docked at a station, with per-bike relocation. */
export function StationBikesSheet({ station, onClose }: StationBikesSheetProps) {
  const { bikes, stations, moveBike } = useStore()

  const atStation = useMemo(
    () => (station ? bikes.filter((b) => b.stationId === station.id) : []),
    [bikes, station],
  )

  const destinations = useMemo(
    () => stations.filter((s) => station && s.id !== station.id),
    [stations, station],
  )

  return (
    <Sheet open={Boolean(station)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {station && (
          <>
            <SheetHeader>
              <SheetTitle>{station.name}</SheetTitle>
              <SheetDescription>
                {atStation.length} bicycle{atStation.length === 1 ? "" : "s"} docked ·{" "}
                {station.available} available · {station.capacity} docks total
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-2 px-4 pb-6">
              {atStation.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <BikeIcon />
                    </EmptyMedia>
                    <EmptyTitle>No bicycles docked here</EmptyTitle>
                    <EmptyDescription>
                      Move bicycles from another station to stock this one.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                atStation.map((bike) => (
                  <BikeRow
                    key={bike.id}
                    bike={bike}
                    destinations={destinations}
                    onMove={async (dest) => {
                      const res = await moveBike(bike.id, dest)
                      if (res.ok) toast.success(res.message)
                      else toast.error(res.message)
                    }}
                  />
                ))
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function BikeRow({
  bike,
  destinations,
  onMove,
}: {
  bike: Bike
  destinations: StationStats[]
  onMove: (destStationId: string) => Promise<void>
}) {
  const [dest, setDest] = useState<string>("")
  const [moving, setMoving] = useState(false)

  async function handleMove() {
    if (!dest) return
    setMoving(true)
    await onMove(dest)
    setMoving(false)
    setDest("")
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-md bg-muted">
            {bike.status === "maintenance" ? (
              <WrenchIcon className="size-4 text-muted-foreground" />
            ) : (
              <BikeIcon className="size-4 text-primary" />
            )}
          </span>
          <div className="flex flex-col">
            <span className="font-mono text-sm font-medium">{bike.id}</span>
            <span className="text-xs text-muted-foreground">{bike.model}</span>
          </div>
        </div>
        <Badge variant="secondary" className={cn("capitalize", STATUS_STYLES[bike.status])}>
          {bike.status}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <Select value={dest} onValueChange={(v) => v && setDest(v)}>
          <SelectTrigger className="flex-1" aria-label={`Move ${bike.id} to station`}>
            <SelectValue placeholder="Move to station…" />
          </SelectTrigger>
          <SelectContent>
            {destinations.map((s) => (
              <SelectItem
                key={s.id}
                value={s.id}
                disabled={s.occupied >= s.capacity}
              >
                {s.shortName} ({s.occupied}/{s.capacity}
                {s.occupied >= s.capacity ? " · full" : ""})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={handleMove} disabled={!dest || moving}>
          <ArrowRightIcon data-icon="inline-start" />
          {moving ? "Moving…" : "Move"}
        </Button>
      </div>
    </div>
  )
}
