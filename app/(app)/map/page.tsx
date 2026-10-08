"use client"

import { useState } from "react"
import { Move, Pencil } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { InteractiveMap } from "@/components/map/interactive-map"
import { StationPanel } from "@/components/map/station-panel"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useStore } from "@/lib/store"
import { HEALTH_LEGEND, getStationHealthColor } from "@/lib/station-health"
import { cn } from "@/lib/utils"
import { StationFrameAvailability } from "@/components/bike-frame-info"

export default function MapPage() {
  const { stations, activeRides, role, updateStation } = useStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [lowFrameOnly, setLowFrameOnly] = useState(false)
  const visibleStations = lowFrameOnly ? stations.filter((station) => station.stepThroughAvailable > 0) : stations
  const selected = stations.find((s) => s.id === selectedId) ?? null
  const isAdmin = role === "admin"

  async function handleMove(id: string, lat: number, lng: number) {
    const s = stations.find((st) => st.id === id)
    const res = await updateStation(id, { lat, lng })
    if (res.ok) {
      toast.success(`${s?.shortName ?? "Station"} moved`, {
        description: `New position: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      })
    } else {
      toast.error(res.message)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Campus Map"
        description={
          isAdmin
            ? "Manage station placement across NIT Trichy. Toggle edit mode to reposition stations."
            : "Live bicycle availability across NIT Trichy. Tap a station to borrow."
        }
        actions={
          isAdmin ? (
            <Button
              variant={editing ? "default" : "outline"}
              onClick={() => { setEditing((v) => !v); setLowFrameOnly(false) }}
            >
              {editing ? <Move data-icon /> : <Pencil data-icon />}
              {editing ? "Done editing" : "Edit layout"}
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant={lowFrameOnly ? "default" : "outline"}
          aria-pressed={lowFrameOnly}
          disabled={editing}
          onClick={() => { setLowFrameOnly((value) => !value); setSelectedId(null) }}
        >
          Low-frame bikes only
        </Button>
        <p className="text-sm leading-relaxed text-muted-foreground" role="status">
          {lowFrameOnly
            ? `${visibleStations.length} stations with low-frame bikes available`
            : "Map labels show available low-frame and high-frame bikes. Pin numbers show the total available."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        <Card className="relative overflow-hidden p-0">
          <div className="absolute left-3 top-3 z-[1200] flex flex-wrap items-center gap-3 rounded-lg border bg-card/90 px-3 py-2 backdrop-blur">
            {HEALTH_LEGEND.map((l) => (
              <div key={l.key} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                <span className="text-xs text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>
          <div className="absolute right-3 top-3 z-[1200] flex items-center gap-1.5 rounded-lg border bg-card/90 px-3 py-2 backdrop-blur">
            <span className="size-2 animate-marker rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">
              {activeRides.length} bikes in transit
            </span>
          </div>
          {editing && (
            <div className="absolute inset-x-0 bottom-3 z-[1200] mx-auto flex w-fit items-center gap-2 rounded-full border bg-card/95 px-4 py-2 shadow-md backdrop-blur">
              <Move className="size-4 text-primary" />
              <span className="text-xs font-medium">Drag any station marker to reposition it</span>
            </div>
          )}
          <div className="aspect-[10/7] w-full">
            <InteractiveMap
              stations={visibleStations}
              selectedId={selectedId}
              onSelect={setSelectedId}
              editable={isAdmin && editing}
              onMove={handleMove}
            />
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          {selected ? (
            <StationPanel
              station={selected}
              editing={isAdmin && editing}
              lowFrameOnly={lowFrameOnly}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <div className="flex flex-col">
              <div className="p-4">
                <h2 className="text-base font-semibold">{lowFrameOnly ? "Low-frame availability" : "All stations"}</h2>
                <p className="text-sm text-muted-foreground">
                  {isAdmin && editing
                    ? "Select a station to edit its details."
                    : "Select a station for details."}
                </p>
              </div>
              {visibleStations.length === 0 && lowFrameOnly && (
                <div className="flex flex-col gap-3 px-4 pb-4">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    No low-frame bikes available right now. Unclassified bikes are not counted until inspected by an admin.
                  </p>
                  <Button variant="outline" onClick={() => setLowFrameOnly(false)}>Show all stations</Button>
                </div>
              )}
              <ul className="flex flex-col gap-1 px-2 pb-2">
                {visibleStations.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => setSelectedId(s.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "size-2.5 rounded-full",
                            s.available === 0 && "animate-marker",
                          )}
                          style={{
                            backgroundColor: getStationHealthColor(s.available, s.capacity),
                          }}
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{s.shortName}</span>
                          <span className="text-xs text-muted-foreground">{s.zone}</span>
                          <StationFrameAvailability station={s} />
                        </div>
                      </div>
                      <Badge variant="secondary" className="font-mono tabular-nums">
                        {s.available}/{s.capacity}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
