"use client"

import { useEffect, useMemo } from "react"
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

const CAMPUS_CENTER: [number, number] = [10.7606, 78.8155]

const PICKER_ICON = L.divIcon({
  className: "cyclenet-marker",
  html: `
    <div style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));line-height:0;">
      <svg width="34" height="46" viewBox="0 0 34 46" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 1C8.163 1 1 8.163 1 17c0 11.6 16 28 16 28s16-16.4 16-28C33 8.163 25.837 1 17 1Z"
          fill="#16a34a" stroke="#ffffff" stroke-width="2" />
        <circle cx="17" cy="17" r="5" fill="#ffffff" />
      </svg>
    </div>`,
  iconSize: [34, 46],
  iconAnchor: [17, 46],
})

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onPick(e.latlng.lat, e.latlng.lng),
  })
  return null
}

/**
 * The picker renders inside a Dialog that animates open, so Leaflet measures
 * a 0-height container on mount and shows a blank/grey map. Re-measure once
 * the dialog has settled so tiles fill the viewport immediately.
 */
function SizeFix() {
  const map = useMap()
  useEffect(() => {
    const timers = [150, 350].map((ms) =>
      setTimeout(() => {
        if ((map as unknown as { _mapPane?: HTMLElement })._mapPane) {
          map.invalidateSize({ animate: false })
        }
      }, ms),
    )
    return () => timers.forEach(clearTimeout)
  }, [map])
  return null
}

interface LocationPickerMapProps {
  lat: number | null
  lng: number | null
  onChange: (lat: number, lng: number) => void
}

export default function LocationPickerMap({ lat, lng, onChange }: LocationPickerMapProps) {
  const position = useMemo<[number, number] | null>(
    () => (lat != null && lng != null ? [lat, lng] : null),
    [lat, lng],
  )

  return (
    <MapContainer
      center={position ?? CAMPUS_CENTER}
      zoom={15}
      scrollWheelZoom
      style={{ height: "100%", width: "100%", background: "#e8e6df" }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors &copy; CARTO"
        subdomains="abcd"
        maxZoom={20}
        updateWhenIdle={false}
        keepBuffer={4}
        crossOrigin="anonymous"
      />
      <SizeFix />
      <ClickHandler onPick={onChange} />
      {position && (
        <Marker
          position={position}
          icon={PICKER_ICON}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const p = e.target.getLatLng()
              onChange(p.lat, p.lng)
            },
          }}
        />
      )}
    </MapContainer>
  )
}
