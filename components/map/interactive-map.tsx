"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"
import type { Station } from "@/lib/types"

const LeafletMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted/30">
      <Skeleton className="h-full w-full" />
    </div>
  ),
})

interface InteractiveMapProps {
  stations: (Station & { available: number; occupied: number })[]
  selectedId: string | null
  onSelect: (id: string) => void
  editable?: boolean
  onMove?: (id: string, lat: number, lng: number) => void
}

export function InteractiveMap(props: InteractiveMapProps) {
  return <LeafletMap {...props} />
}
