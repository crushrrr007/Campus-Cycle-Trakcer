"use client"

import { useEffect, useMemo, useState } from "react"
import { MapContainer, TileLayer, Marker, Circle, CircleMarker, Tooltip, useMap, useMapEvents, ZoomControl } from "react-leaflet"
import L from "leaflet"
import type { StationStats } from "@/lib/store"
import type { InteractiveMapProps } from "./interactive-map"
import { stationAvailability, validCoordinates, type StationPurpose } from "@/lib/station-navigation"
import { getStationHealthColor } from "@/lib/station-health"
import "leaflet/dist/leaflet.css"

/**
 * Defensive guard against a Leaflet crash:
 *   "Cannot read properties of undefined (reading '_leaflet_pos')"
 *
 * When a map is torn down (theme toggle, HMR, React StrictMode double-mount)
 * `map.remove()` deletes the internal panes, but a queued zoom `transitionend`
 * (or a moveend/resize) callback can still fire afterwards. Those callbacks read
 * `this._mapPane` and throw. We patch the prototype ONCE so any such late
 * callback bails out safely instead of crashing.
 */
function patchLeafletTeardownGuards() {
  const proto = L.Map.prototype as unknown as Record<string, unknown> & {
    __teardownGuarded?: boolean
  }
  if (proto.__teardownGuarded) return
  proto.__teardownGuarded = true

  const methods = [
    "_onZoomTransitionEnd",
    "_catchTransitionEnd",
    "_animateZoom",
    "_getMapPanePos",
    "_getNewPixelOrigin",
    "_moveEnd",
  ]

  for (const name of methods) {
    const original = proto[name] as ((...args: unknown[]) => unknown) | undefined
    if (typeof original !== "function") continue
    proto[name] = function patched(this: { _mapPane?: HTMLElement; _panes?: unknown }, ...args: unknown[]) {
      // If the map has been removed, its panes are gone — skip the callback.
      if (!this._mapPane || !this._panes) return undefined
      return original.apply(this, args)
    }
  }
}

if (typeof window !== "undefined") {
  patchLeafletTeardownGuards()
}

const CAMPUS_CENTER: [number, number] = [10.7606, 78.8155]

function buildIcon(station: StationStats, selected: boolean, purpose: StationPurpose, lowFrameOnly: boolean, uncertain: boolean, editable = false) {
  const info = stationAvailability(station, purpose, lowFrameOnly)
  const symbol = uncertain ? "?" : info.state === "offline" ? "×" : editable ? station.available : info.count
  return L.divIcon({
    className: `cyclenet-marker ${uncertain ? "uncertain" : info.state}${selected ? " selected" : ""}`,
    html: `<span class="cyclenet-pin"${editable && !uncertain ? ` style="background:${getStationHealthColor(station.available, station.capacity)};color:var(--background)"` : ""}>${symbol}</span>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    tooltipAnchor: [0, -24],
  })
}

function MapController({ stations, selectedId, resetSignal = 0, locateSignal = 0, origin }: InteractiveMapProps) {
  const map = useMap()
  const key = stations.map((station) => station.id).sort().join(",")
  useEffect(() => {
    map.invalidateSize({ animate: false })
    const points = stations.filter(validCoordinates).map((station) => L.latLng(station.lat, station.lng))
    if (points.length) map.fitBounds(L.latLngBounds(points), { paddingTopLeft: [40, 48], paddingBottomRight: [40, window.innerWidth < 768 ? 150 : 48], maxZoom: 17, animate: false })
    // Fit only on station membership changes or an explicit recenter request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key, resetSignal])

  const station = stations.find((item) => item.id === selectedId)
  const lat = station?.lat
  const lng = station?.lng
  useEffect(() => {
    if (lat !== undefined && lng !== undefined && validCoordinates({ lat, lng })) {
      map.setView([lat, lng], Math.max(map.getZoom(), 17), { animate: false })
      if (window.innerWidth < 768) map.panBy([0, 80], { animate: false })
    }
  }, [map, selectedId, lat, lng])

  useEffect(() => {
    if (locateSignal && origin && validCoordinates(origin)) map.setView([origin.lat, origin.lng], 17, { animate: false })
    // Only explicit locate requests should move the camera, not a data refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, locateSignal])

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if ((map as unknown as { _mapPane?: HTMLElement })._mapPane) map.invalidateSize({ animate: false, pan: false })
    })
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])
  return null
}

function StationMarkers({ stations, selectedId, onSelect, editable, onMove, purpose = "borrow", lowFrameOnly = false, availabilityUncertain = false }: InteractiveMapProps) {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) })
  const markers = useMemo(() => stations.filter(validCoordinates).map((station) => ({ station, icon: buildIcon(station, station.id === selectedId, purpose, lowFrameOnly, availabilityUncertain, editable) })), [stations, selectedId, purpose, lowFrameOnly, availabilityUncertain, editable])
  return <>{markers.map(({ station, icon }) => {
    const info = stationAvailability(station, purpose, lowFrameOnly)
    const markerLabel = `${station.name}: ${availabilityUncertain ? "availability unconfirmed" : `${info.count} ${info.label}, ${info.reason}`}`
    return <Marker key={`${station.id}:${markerLabel}`} position={[station.lat, station.lng]} icon={icon} title={markerLabel} alt={markerLabel} draggable={editable} eventHandlers={{
      add: (event) => { event.target.getElement()?.setAttribute("aria-label", markerLabel) },
      click: () => onSelect(station.id),
      dragend: (event) => { const { lat, lng } = event.target.getLatLng(); onMove?.(station.id, lat, lng) },
    }} zIndexOffset={station.id === selectedId ? 1000 : 0}>
      <Tooltip key={zoom >= 17 || selectedId === station.id ? "visible" : "hover"} direction="top" permanent={zoom >= 17 || selectedId === station.id} className="cyclenet-tooltip">
        <span>{station.shortName}{!info.usable && !availabilityUncertain ? ` · ${info.reason}` : ""}</span>
      </Tooltip>
    </Marker>
  })}</>
}

export default function LeafletMap(props: InteractiveMapProps) {
  const { gpsLocation, origin, accuracy, onTileError, resetSignal = 0 } = props
  return <MapContainer className="cyclenet-map font-sans" center={CAMPUS_CENTER} zoom={16} scrollWheelZoom zoomControl={false}
    // Keep teardown-safe, non-animated camera updates during theme and HMR changes.
    zoomAnimation={false} markerZoomAnimation={false} style={{ height: "100%", width: "100%", background: "var(--muted)" }}>
    <ZoomControl position="topleft" />
    <TileLayer key={resetSignal} className="saturate-50 dark:invert dark:hue-rotate-180 dark:saturate-25 dark:brightness-75" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution={'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'} maxZoom={19} updateWhenIdle keepBuffer={2} crossOrigin="anonymous" eventHandlers={{ tileerror: () => onTileError?.() }} />
    <StationMarkers {...props} />
    {gpsLocation && validCoordinates(gpsLocation) && <>
      {accuracy !== null && accuracy !== undefined && Number.isFinite(accuracy) && accuracy > 0 && <Circle center={[gpsLocation.lat, gpsLocation.lng]} radius={Math.min(accuracy, 5000)} interactive={false} pathOptions={{ color: "var(--primary)", fillColor: "var(--primary)", fillOpacity: 0.08, weight: 1 }} />}
      <CircleMarker center={[gpsLocation.lat, gpsLocation.lng]} radius={7} pathOptions={{ color: "var(--foreground)", fillColor: "var(--primary)", fillOpacity: 1, weight: 2 }}><Tooltip>My location · approximate</Tooltip></CircleMarker>
    </>}
    {origin && validCoordinates(origin) && (!gpsLocation || origin.lat !== gpsLocation.lat || origin.lng !== gpsLocation.lng) && <CircleMarker center={[origin.lat, origin.lng]} radius={24} interactive={false} pathOptions={{ color: "var(--primary)", fillOpacity: 0, weight: 2, dashArray: "4 4" }} />}
    <MapController {...props} />
  </MapContainer>
}
