"use client"

import { useEffect, useState } from "react"
import { Move, Pencil } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { CampusMapWorkspace } from "@/components/map/campus-map-workspace"
import { NearestStationFinder } from "@/components/map/nearest-station-finder"
import { MapAvailabilityStatus } from "@/components/map/map-availability-status"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useCampusLocation } from "@/hooks/use-campus-location"
import { useStore } from "@/lib/store"
import { searchCampusStations } from "@/lib/campus-search"
import { availabilityIsStale, distanceMeters, isUsableStation, nearestUsableStations, type StationPurpose } from "@/lib/station-navigation"

export default function MapPage() {
  const { stations, myActiveRide, role, updateStation, dataLoading, availabilityUpdatedAt, availabilityRefreshing, availabilityError, refreshData, isDemo } = useStore()
  const [purposeOverride, setPurposeOverride] = useState<StationPurpose | null>(null)
  const purpose = purposeOverride ?? (myActiveRide ? "return" : "borrow")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [lowFrameOnly, setLowFrameOnly] = useState(false)
  const [query, setQuery] = useState("")
  const [resetSignal, setResetSignal] = useState(0)
  const [tileError, setTileError] = useState(false)
  const [now, setNow] = useState<number | null>(null)
  const location = useCampusLocation()
  useEffect(() => {
    const update = () => setNow(Date.now())
    const initial = window.setTimeout(update, 0)
    const timer = window.setInterval(update, 10000)
    return () => { window.clearTimeout(initial); window.clearInterval(timer) }
  }, [])
  const uncertain = !isDemo && (availabilityError || availabilityUpdatedAt === null || now === null || availabilityIsStale(availabilityUpdatedAt, Math.max(now, availabilityUpdatedAt)))
  const effectiveLowFrame = !editing && lowFrameOnly && purpose === "borrow"
  const origin = location.originId === "gps" ? location.gps : stations.find((station) => station.id === location.originId) ?? null
  const entries = searchCampusStations(stations, editing ? "" : query).sort((a, b) => {
    const usableFirst = !uncertain ? Number(isUsableStation(b.station, purpose, effectiveLowFrame)) - Number(isUsableStation(a.station, purpose, effectiveLowFrame)) : 0
    return usableFirst || (origin ? distanceMeters(origin, a.station) - distanceMeters(origin, b.station) : 0) || a.station.shortName.localeCompare(b.station.shortName)
  })
  const visibleStations = entries.map((entry) => entry.station)
  const selected = visibleStations.find((station) => station.id === selectedId) ?? null
  const recommendation = !editing && !uncertain && origin ? nearestUsableStations(visibleStations, origin, purpose, effectiveLowFrame, 1)[0]?.station ?? null : null
  const panelStation = selected ?? recommendation
  const alternative = selected && origin && !uncertain && !isUsableStation(selected, purpose, effectiveLowFrame) ? nearestUsableStations(visibleStations.filter((station) => station.id !== selected.id), origin, purpose, effectiveLowFrame, 1)[0]?.station : null

  function changeQuery(value: string) { setQuery(value); setSelectedId(null) }
  async function handleMove(id: string, lat: number, lng: number) {
    try {
      const result = await updateStation(id, { lat, lng })
      if (result.ok) toast.success("Station position saved")
      else toast.error(result.message)
    } catch { toast.error("Unable to move this station. Please try again.") }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader title="Campus Map" description={editing ? "Drag a station to reposition it. Changes are saved to the campus layout." : "Find a bicycle or a free dock across NIT Trichy."} actions={role === "admin" ? <Button variant={editing ? "default" : "outline"} onClick={() => { setEditing((value) => !value); setSelectedId(null); setQuery(""); setLowFrameOnly(false) }}>{editing ? <Move data-icon /> : <Pencil data-icon />}{editing ? "Done editing" : "Edit layout"}</Button> : undefined} />
      {!editing && <NearestStationFinder stations={stations} purpose={purpose} onPurposeChange={(value) => { setPurposeOverride(value); setSelectedId(null) }} query={query} onQueryChange={changeQuery} originId={location.originId} onOriginChange={location.setOriginId} hasLocation={!!location.gps} locating={location.locating} onLocate={location.locate} lowFrameOnly={effectiveLowFrame} onLowFrameChange={() => { setLowFrameOnly((value) => !value); setSelectedId(null) }} disabled={dataLoading} />}
      {location.message && !editing && <Alert><AlertTitle>Location guidance</AlertTitle><AlertDescription>{location.message} You can choose a starting station instead.</AlertDescription></Alert>}
      <MapAvailabilityStatus updatedAt={availabilityUpdatedAt} now={now} loading={dataLoading} refreshing={availabilityRefreshing} uncertain={uncertain} demo={isDemo} onRefresh={refreshData} />
      <CampusMapWorkspace entries={entries} stations={visibleStations} selected={panelStation} recommended={!selected && !!recommendation} purpose={purpose} lowFrameOnly={effectiveLowFrame} origin={origin} gpsLocation={location.gps} accuracy={location.accuracy} locateSignal={location.locateSignal} resetSignal={resetSignal} uncertain={uncertain} loading={dataLoading} query={query} editing={editing} tileError={tileError} alternative={alternative ?? null} onSelect={setSelectedId} onClose={() => setSelectedId(null)} onClear={() => changeQuery("")} onMove={handleMove} onTileError={() => setTileError(true)} onReset={() => { setTileError(false); setResetSignal((value) => value + 1) }} />
      <p className="text-sm leading-relaxed text-muted-foreground">Availability is not a reservation. Distances are straight-line estimates; directions open in Google Maps. Landmark search suggests area stations, not verified building entrances.</p>
    </div>
  )
}
