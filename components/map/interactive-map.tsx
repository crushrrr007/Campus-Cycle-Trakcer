"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"
import type { StationStats } from "@/lib/store"
import type { Coordinates, StationPurpose } from "@/lib/station-navigation"

const LeafletMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted/30">
      <Skeleton className="h-full w-full" />
    </div>
  ),
})

export interface InteractiveMapProps {
  stations: StationStats[]
  selectedId: string | null
  onSelect: (id: string) => void
  editable?: boolean
  onMove?: (id: string, lat: number, lng: number) => void
  purpose?: StationPurpose
  lowFrameOnly?: boolean
  origin?: Coordinates | null
  gpsLocation?: Coordinates | null
  accuracy?: number | null
  resetSignal?: number
  locateSignal?: number
  availabilityUncertain?: boolean
  onTileError?: () => void
}

export function InteractiveMap(props: InteractiveMapProps) {
  return <LeafletMap {...props} />
}
