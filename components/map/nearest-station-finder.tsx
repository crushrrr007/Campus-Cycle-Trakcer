"use client"

import { useRef, useState } from "react"
import { LocateFixed, MapPin, Navigation } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { StationStats } from "@/lib/store"
import { directionsUrl, formatDistance, freeDocks, nearestUsableStations, validCoordinates, type Coordinates, type StationPurpose } from "@/lib/station-navigation"

export function NearestStationFinder({ stations, purpose, onPurposeChange, lowFrameOnly, onSelect, loading, unavailable }: {
  stations: StationStats[]
  purpose: StationPurpose
  onPurposeChange: (purpose: StationPurpose) => void
  lowFrameOnly: boolean
  onSelect: (id: string) => void
  loading: boolean
  unavailable: boolean
}) {
  const [originId, setOriginId] = useState("")
  const [location, setLocation] = useState<Coordinates | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState("")
  const request = useRef(0)
  const origin = originId === "gps" ? location : stations.find((station) => station.id === originId) ?? null
  const results = origin && !loading && !unavailable ? nearestUsableStations(stations, origin, purpose, lowFrameOnly) : []
  const originItems = [
    ...(location ? [{ value: "gps", label: "My location" }] : []),
    ...stations.filter(validCoordinates).map((station) => ({ value: station.id, label: station.name })),
  ]

  function locate() {
    if (locating) return
    setLocationError("")
    if (!navigator.geolocation || !window.isSecureContext) {
      setLocationError("Location is unavailable here. Choose a campus station as your starting point instead.")
      return
    }
    const token = ++request.current
    setLocating(true)
    navigator.geolocation.getCurrentPosition((position) => {
      if (token !== request.current) return
      setLocating(false)
      const point = { lat: position.coords.latitude, lng: position.coords.longitude }
      if (!validCoordinates(point)) {
        setLocationError("Your location could not be read. Choose a starting station instead.")
        return
      }
      setLocation(point)
      setAccuracy(position.coords.accuracy)
      setOriginId("gps")
    }, (error) => {
      if (token !== request.current) return
      setLocating(false)
      setLocationError(error.code === 1
        ? "Location permission was denied or blocked by the preview. Choose a starting station below; GPS also works on the published site."
        : "Your location could not be found. Try again or choose a starting station.")
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Navigation className="size-5 text-primary" />Nearest usable station</CardTitle>
        <CardDescription>Find a bike to borrow or an open dock to return one. No location tracking.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field className="sm:w-48">
            <FieldLabel htmlFor="station-purpose">I need to</FieldLabel>
            <Select value={purpose} onValueChange={(value) => { if (value === "borrow" || value === "return") onPurposeChange(value) }} items={[{ value: "borrow", label: "Borrow a bike" }, { value: "return", label: "Return a bike" }]}>
              <SelectTrigger id="station-purpose" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup><SelectItem value="borrow">Borrow a bike</SelectItem><SelectItem value="return">Return a bike</SelectItem></SelectGroup></SelectContent>
            </Select>
          </Field>
          <Field className="min-w-0 sm:flex-1">
            <FieldLabel htmlFor="station-origin">Starting point</FieldLabel>
            <Select value={originId} items={originItems} onValueChange={(value) => {
              if (!value) return
              request.current += 1
              setLocating(false)
              setOriginId(value)
              setLocationError("")
            }}>
              <SelectTrigger id="station-origin" className="w-full"><SelectValue placeholder="Choose a campus station" /></SelectTrigger>
              <SelectContent><SelectGroup>{originItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
          </Field>
          <Button variant="outline" disabled={locating} onClick={locate}><LocateFixed data-icon />{locating ? "Finding location…" : "Use my location"}</Button>
        </div>
        {locationError && <p role="alert" className="text-sm leading-relaxed text-muted-foreground">{locationError}</p>}
        {originId === "gps" && accuracy !== null && <p className="text-sm leading-relaxed text-muted-foreground">Location accuracy: approximately {Math.round(accuracy)} m. Choose a station manually if this looks inaccurate.</p>}
        <div role="status" aria-live="polite" className="text-sm leading-relaxed text-muted-foreground">
          {loading ? "Loading current availability…" : unavailable ? "Availability could not be refreshed. Recommendations are paused until the connection recovers." : !origin ? "Choose a starting point or allow location access to rank nearby stations." : results.length === 0 ? (purpose === "return" ? "No open docks right now. Check again shortly." : lowFrameOnly ? "No usable stations with verified low-frame bikes right now." : "No usable stations with available bikes right now.") : `${results.length} nearby options · straight-line distances, not route lengths. Availability refreshes every 15 seconds and is checked again when you borrow or return.`}
        </div>
        {results.length > 0 && <ul className="flex flex-col gap-2">
          {results.map(({ station, distance }) => <li key={station.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <MapPin className="size-5 shrink-0 text-primary" />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm font-medium">{station.name}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{formatDistance(distance)} away · {purpose === "return" ? `${freeDocks(station)} free docks` : lowFrameOnly ? `${station.stepThroughAvailable} low-frame bikes available` : `${station.available} bikes available`}</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => onSelect(station.id)} aria-label={`Show ${station.name} on map`}>Show on map</Button>
              <Button size="sm" variant="outline" nativeButton={false} render={<a href={directionsUrl(station, origin)} target="_blank" rel="noopener noreferrer" />} aria-label={`Walking directions to ${station.name} (opens Google Maps)`}><Navigation data-icon />Directions</Button>
            </div>
          </li>)}
        </ul>}
        {origin && results.length > 0 && <p className="text-sm leading-relaxed text-muted-foreground">Directions open Google Maps and share the selected origin and destination with that service. Bike and dock availability is not a reservation.</p>}
      </CardContent>
    </Card>
  )
}
