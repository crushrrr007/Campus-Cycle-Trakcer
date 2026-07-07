"use client"

import { useEffect, useMemo } from "react"
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap, ZoomControl } from "react-leaflet"
import L from "leaflet"
import type { Station } from "@/lib/types"
import { getStationHealth, getStationHealthColor, HEALTH_LABELS } from "@/lib/station-health"
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

interface LeafletMapProps {
  stations: (Station & { available: number; occupied: number })[]
  selectedId: string | null
  onSelect: (id: string) => void
  editable?: boolean
  onMove?: (id: string, lat: number, lng: number) => void
}

const CAMPUS_CENTER: [number, number] = [10.7606, 78.8155]

// Classic Leaflet-style teardrop pin, color-coded by fill health, with the
// live available-cycle count rendered in white at the center.
function buildIcon(
  station: Station & { available: number; capacity: number },
  selected: boolean,
) {
  const color = getStationHealthColor(station.available, station.capacity)
  const scale = selected ? 1.2 : 1
  const w = Math.round(34 * scale)
  const h = Math.round(46 * scale)
  const fontSize = selected ? 15 : 13
  const shadow = selected
    ? "drop-shadow(0 4px 6px rgba(0,0,0,.45))"
    : "drop-shadow(0 2px 3px rgba(0,0,0,.35))"
  return L.divIcon({
    className: "cyclenet-marker",
    html: `
      <div style="filter:${shadow};line-height:0;">
        <svg width="${w}" height="${h}" viewBox="0 0 34 46" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 1C8.163 1 1 8.163 1 17c0 11.6 16 28 16 28s16-16.4 16-28C33 8.163 25.837 1 17 1Z"
            fill="${color}" stroke="#ffffff" stroke-width="2" />
          <text x="17" y="17.5" text-anchor="middle" dominant-baseline="central"
            fill="#ffffff" font-family="var(--font-sans), system-ui, sans-serif"
            font-size="${fontSize}" font-weight="700">${station.available}</text>
        </svg>
      </div>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h + 8],
  })
}

function MapController({
  stations,
}: {
  stations: Station[]
}) {
  const map = useMap()
  // Only refit when the set of stations changes (add/remove), not on position edits.
  const key = stations.map((s) => s.id).join(",")
  useEffect(() => {
    if (stations.length === 0) return
    const bounds = L.latLngBounds(stations.map((s) => [s.lat, s.lng]))
    // `animate: false` avoids a zoom transition whose end-callback can fire
    // after the map pane is torn down (theme toggle / unmount) and crash.
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 17, animate: false })
    // Recalculate size in case the container mounted before layout settled.
    const t = setTimeout(() => {
      // Guard: the map may have been removed before this fires.
      if ((map as unknown as { _mapPane?: HTMLElement })._mapPane) {
        map.invalidateSize({ animate: false })
      }
    }, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key])
  return null
}

export default function LeafletMap({ stations, selectedId, onSelect, editable, onMove }: LeafletMapProps) {
  // CARTO Voyager tiles: OSM-based street map served from a fast global CDN
  // (4 parallel subdomains) — dramatically quicker first paint than the
  // donated openstreetmap.org tile servers, which often stall for seconds.
  const tileUrl = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
  const tileAttribution = "&copy; OpenStreetMap contributors &copy; CARTO"

  const markers = useMemo(
    () =>
      stations.map((s) => ({
        station: s,
        icon: buildIcon(s, s.id === selectedId),
      })),
    [stations, selectedId],
  )

  return (
    <MapContainer
      center={CAMPUS_CENTER}
      zoom={16}
      scrollWheelZoom
      zoomControl={false}
      // Disable zoom animation: its `transitionend` callback (`_onZoomTransitionEnd`)
      // can fire after the map pane is torn down during a re-render/unmount
      // (e.g. theme toggle) and crash reading `_leaflet_pos`.
      zoomAnimation={false}
      markerZoomAnimation={false}
      style={{ height: "100%", width: "100%", background: "#e8e6df" }}
    >
      <ZoomControl position="topleft" />
      <TileLayer
        url={tileUrl}
        attribution={tileAttribution}
        subdomains="abcd"
        maxZoom={20}
        // Start loading tiles immediately while panning/zooming instead of
        // waiting for movement to stop, and keep a ring of off-screen tiles
        // cached so the map never looks blank at the edges.
        updateWhenIdle={false}
        keepBuffer={4}
        crossOrigin="anonymous"
      />
      {markers.map(({ station, icon }) => {
        const color = getStationHealthColor(station.available, station.capacity)
        const healthLabel = HEALTH_LABELS[getStationHealth(station.available, station.capacity)]
        const freeDocks = Math.max(0, station.capacity - station.available)
        return (
          <Marker
            key={station.id}
            position={[station.lat, station.lng]}
            icon={icon}
            draggable={editable}
            eventHandlers={{
              click: () => onSelect(station.id),
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng()
                onMove?.(station.id, lat, lng)
              },
            }}
            zIndexOffset={station.id === selectedId ? 1000 : 0}
          >
            <Tooltip
              direction="top"
              offset={[0, -44]}
              permanent
              className="cyclenet-tooltip"
            >
              {station.name}
            </Tooltip>
            <Popup>
              <div className="min-w-40 space-y-1.5">
                <p className="text-sm font-semibold leading-tight text-[#111827]">{station.name}</p>
                <p className="text-xs text-[#6b7280]">{station.zone}</p>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs font-medium text-[#111827]">{healthLabel}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-1 text-xs">
                  <span className="text-[#6b7280]">Available</span>
                  <span className="text-right font-semibold text-[#111827]">
                    {station.available}/{station.capacity}
                  </span>
                  <span className="text-[#6b7280]">Free docks</span>
                  <span className="text-right font-semibold text-[#111827]">{freeDocks}</span>
                </div>
              </div>
            </Popup>
          </Marker>
        )
      })}
      <MapController stations={stations} />
    </MapContainer>
  )
}
