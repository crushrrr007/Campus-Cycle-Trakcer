"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, ChevronUp, CircleCheck, CircleMinus, List, Map as MapIcon, MapPin, PowerOff, RotateCcw } from "lucide-react"
import { InteractiveMap, type InteractiveMapProps } from "./interactive-map"
import { StationPanel } from "./station-panel"
import { StationList } from "./station-list"
import { useIsMobile } from "@/hooks/use-mobile"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import type { StationStats } from "@/lib/store"
import { HEALTH_LEGEND } from "@/lib/station-health"
import { cn } from "@/lib/utils"

interface WorkspaceProps extends InteractiveMapProps {
  entries: { station: StationStats; landmark: string | null }[]
  selected: StationStats | null
  recommended: boolean
  uncertain: boolean
  loading: boolean
  query: string
  editing: boolean
  tileError: boolean
  alternative: StationStats | null
  onClose: () => void
  onClear: () => void
  onReset: () => void
}

export function CampusMapWorkspace({ entries, selected, recommended, uncertain, loading, query, editing, tileError, alternative, onClose, onClear, onReset, ...mapProps }: Omit<WorkspaceProps, "selectedId">) {
  const mobile = useIsMobile()
  const [view, setView] = useState("map")
  const [expanded, setExpanded] = useState(false)
  const workspace = useRef<HTMLDivElement>(null)
  const selectedId = selected?.id
  useEffect(() => {
    if (mobile && selectedId) workspace.current?.scrollIntoView({ block: "start", behavior: "instant" })
  }, [mobile, selectedId])
  const purpose = mapProps.purpose ?? "borrow"
  const lowFrameOnly = mapProps.lowFrameOnly ?? false
  const list = <StationList entries={entries} purpose={purpose} lowFrameOnly={lowFrameOnly} origin={mapProps.origin ?? null} uncertain={uncertain} loading={loading} query={query} onSelect={(id) => { mapProps.onSelect(id); setView("map"); setExpanded(false) }} onClear={onClear} />
  const panel = selected ? <StationPanel key={`${selected.id}:${purpose}`} station={selected} purpose={purpose} lowFrameOnly={lowFrameOnly} origin={mapProps.origin ?? null} uncertain={uncertain} recommended={recommended} compact={mobile && !expanded && !editing} editing={editing} onClose={onClose} /> : null
  return <Tabs value={mobile ? view : "map"} onValueChange={(value) => setView(String(value))} className="min-w-0">
    <TabsList className="md:hidden" aria-label="Campus map view"><TabsTrigger value="map"><MapIcon />Map</TabsTrigger><TabsTrigger value="list"><List />Station list</TabsTrigger></TabsList>
    <TabsContent value="map" keepMounted>
      <div ref={workspace} className="flex min-w-0 scroll-mt-20 flex-col gap-3 md:flex-row">
        <Card className="min-w-0 flex-1 gap-0 py-0">
          <CardContent className="relative flex flex-col p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
              <div className="flex flex-wrap items-center gap-3" aria-label="Station marker legend">
                {editing ? HEALTH_LEGEND.map((item) => <span key={item.key} className="flex items-center gap-1.5 text-sm text-muted-foreground"><span className="size-2.5 rounded-full" style={{ background: item.color }} />{item.label}</span>) : <>
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><CircleCheck className="size-4 text-primary" />Usable</span>
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><CircleMinus className="size-4" />Unavailable</span>
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><PowerOff className="size-4" />Offline</span>
                </>}
              </div>
              <Button variant="ghost" size="sm" onClick={onReset}><RotateCcw data-icon />Recenter</Button>
            </div>
            {tileError && <Alert><AlertTitle>Map tiles unavailable</AlertTitle><AlertDescription>Station data still works. Try Recenter to reload tiles or use the station list.</AlertDescription></Alert>}
            <div className="campus-map-viewport">
              {loading && mapProps.stations.length === 0 ? <Skeleton className="size-full" /> : <InteractiveMap {...mapProps} selectedId={selected?.id ?? null} editable={editing} availabilityUncertain={uncertain} />}
            </div>
            {editing && <p className="border-t px-4 py-2 text-sm text-muted-foreground">Drag markers to save new coordinates. Select a station to edit its details.</p>}
            {mobile && selected && <section aria-label="Selected station" className={cn("campus-station-sheet flex flex-col rounded-t-xl border-t bg-card text-card-foreground", expanded && "is-expanded")}>
              <div className="flex items-center justify-between px-3 pt-2">
                <span className="text-sm text-muted-foreground">{recommended ? "Nearest usable station" : "Selected station"}</span>
                <Button variant="ghost" size="sm" aria-expanded={expanded} aria-controls="mobile-station-details" onClick={() => setExpanded((value) => !value)}>{expanded ? <ChevronDown data-icon /> : <ChevronUp data-icon />}{expanded ? "Collapse" : "Expand"}</Button>
              </div>
              <div id="mobile-station-details" className="min-h-0 overflow-y-auto">{panel}</div>
            </section>}
            {mobile && !selected && <div className="border-t px-4 py-3"><p className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="size-4" />{loading ? "Loading stations…" : "Tap a pin, or open the station list."}</p></div>}
          </CardContent>
        </Card>
        {!mobile && <Card className="campus-station-sidebar w-64 shrink-0 gap-0 overflow-y-auto py-0 lg:w-72 xl:w-80"><CardContent className="p-0">
          {panel}
          {alternative && <Alert><AlertTitle>Try {alternative.shortName}</AlertTitle><AlertDescription>This station no longer suits your journey.<Button variant="outline" size="sm" onClick={() => mapProps.onSelect(alternative.id)}>Show alternative</Button></AlertDescription></Alert>}
          {panel && <Separator />}{list}
        </CardContent></Card>}
      </div>
      {mobile && alternative && <Alert><AlertTitle>Another station is available</AlertTitle><AlertDescription><Button variant="outline" onClick={() => mapProps.onSelect(alternative.id)}>Try {alternative.shortName}</Button></AlertDescription></Alert>}
    </TabsContent>
    <TabsContent value="list"><Card className="gap-0 py-0"><CardContent className="p-0">{list}</CardContent></Card></TabsContent>
  </Tabs>
}
