"use client"

import { useState } from "react"
import { MapPin, Move, Pencil } from "lucide-react"
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

export default function MapPage() {
  const { stations, activeRides, role, updateStation } = useStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
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
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? <Move data-icon /> : <Pencil data-icon />}
              {editing ? "Done editing" : "Edit layout"}
            </Button>
          ) : undefined
        }
      />

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
              stations={stations}
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
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <div className="flex flex-col">
              <div className="p-4">
                <h2 className="text-base font-semibold">All stations</h2>
                <p className="text-sm text-muted-foreground">
                  {isAdmin && editing
                    ? "Select a station to edit its details."
                    : "Select a station for details."}
                </p>
              </div>
              <ul className="flex flex-col gap-1 px-2 pb-2">
                {stations.map((s) => (
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
