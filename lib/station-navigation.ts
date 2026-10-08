import type { StationStats } from "./store"

export interface Coordinates { lat: number; lng: number }
export type StationPurpose = "borrow" | "return"

export function validCoordinates(point: Coordinates) {
  return Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180
}

export function freeDocks(station: Pick<StationStats, "capacity" | "occupied">) {
  return Math.max(0, station.capacity - station.occupied)
}

export function isUsableStation(station: StationStats, purpose: StationPurpose, lowFrameOnly = false) {
  if (station.capacity <= 0 || station.status === "offline") return false
  return purpose === "return" ? freeDocks(station) > 0 : (lowFrameOnly ? station.stepThroughAvailable : station.available) > 0
}

export function distanceMeters(from: Coordinates, to: Coordinates) {
  if (!validCoordinates(from) || !validCoordinates(to)) return Infinity
  const radians = (degrees: number) => degrees * Math.PI / 180
  const a = Math.sin(radians(to.lat - from.lat) / 2) ** 2 + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(radians(to.lng - from.lng) / 2) ** 2
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))))
}

export function nearestUsableStations(stations: StationStats[], origin: Coordinates, purpose: StationPurpose, lowFrameOnly = false, limit = 3) {
  if (!validCoordinates(origin)) return []
  return stations.filter((station) => validCoordinates(station) && isUsableStation(station, purpose, lowFrameOnly))
    .map((station) => ({ station, distance: distanceMeters(origin, station) }))
    .sort((a, b) => a.distance - b.distance || a.station.id.localeCompare(b.station.id))
    .slice(0, Math.max(0, limit))
}

export function directionsUrl(destination: Coordinates, origin?: Coordinates | null) {
  const params = new URLSearchParams({ api: "1", destination: `${destination.lat},${destination.lng}`, travelmode: "walking" })
  if (origin && validCoordinates(origin)) params.set("origin", `${origin.lat},${origin.lng}`)
  return `https://www.google.com/maps/dir/?${params}`
}

export function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`
}
