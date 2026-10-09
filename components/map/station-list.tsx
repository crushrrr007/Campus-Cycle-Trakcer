"use client"

import { ArrowUpRight, CircleCheck, CircleMinus, MapPin, PowerOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import type { StationStats } from "@/lib/store"
import { distanceMeters, formatDistance, stationAvailability, type Coordinates, type StationPurpose } from "@/lib/station-navigation"
import { cn } from "@/lib/utils"

export function StationList({ entries, purpose, lowFrameOnly, origin, uncertain, loading, query, onSelect, onClear }: {
  entries: { station: StationStats; landmark: string | null }[]
  purpose: StationPurpose
  lowFrameOnly: boolean
  origin: Coordinates | null
  uncertain: boolean
  loading: boolean
  query: string
  onSelect: (id: string) => void
  onClear: () => void
}) {
  return <section id="campus-station-results" className="flex flex-col" aria-label="Campus station results">
    <div className="flex flex-col gap-1 p-4">
      <h2 className="text-base font-semibold">{query.trim() ? "Campus search" : origin ? "Nearby stations" : "Campus stations"}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{loading ? "Loading availability…" : query.trim() ? `${entries.length} matching stations` : origin && !uncertain ? "Usable stations first, closest to your starting point." : "Select a station to plan your journey."}</p>
    </div>
    {!loading && entries.length === 0 ? <Empty>
      <EmptyHeader><EmptyMedia variant="icon"><MapPin /></EmptyMedia><EmptyTitle>No matching stations</EmptyTitle><EmptyDescription>{query.trim() ? "Try another station, hostel, or department." : "Campus stations are not available yet."}</EmptyDescription></EmptyHeader>
      {query.trim() && <Button variant="outline" onClick={onClear}>Clear search</Button>}
    </Empty> : <ul className="flex flex-col px-2 pb-2">
      {entries.map(({ station, landmark }) => {
        const info = stationAvailability(station, purpose, lowFrameOnly)
        const Icon = info.state === "offline" ? PowerOff : info.usable ? CircleCheck : CircleMinus
        const distance = origin ? distanceMeters(origin, station) : Infinity
        return <li key={station.id}>
          <button type="button" onClick={() => onSelect(station.id)} className="flex w-full items-start gap-3 rounded-lg px-3 py-4 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring" aria-label={`Show ${station.name}: ${uncertain ? "availability unconfirmed" : `${info.count} ${info.label}, ${info.reason}`}`}>
            <Icon className={cn("size-4 shrink-0", info.usable && !uncertain ? "text-primary" : "text-muted-foreground")} aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-sm font-semibold">{station.shortName}</span>
              <span className="text-sm leading-relaxed text-muted-foreground">{landmark ? `For ${landmark} · area station` : station.zone}{Number.isFinite(distance) ? ` · ${formatDistance(distance)} straight-line` : ""}</span>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("text-sm", info.usable && !uncertain ? "text-primary" : "text-muted-foreground")}>{uncertain ? "Availability unconfirmed" : `${info.count} ${info.label}`}</span>
                {!info.usable && !uncertain && <Badge variant="secondary">{info.reason}</Badge>}
              </div>
            </div>
            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </li>
      })}
    </ul>}
  </section>
}
