import type { StationStats } from "./store"
import type { Bike, Ride } from "./types"

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const REF = new Date(Date.UTC(2026, 5, 14, 9, 30, 0))

export function dailyUsage(rides: Ride[], days = 14) {
  const buckets: { date: string; label: string; trips: number; duration: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(REF.getTime() - i * 86400000)
    buckets.push({
      date: d.toISOString().slice(0, 10),
      label: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`,
      trips: 0,
      duration: 0,
    })
  }
  const map = new Map(buckets.map((b) => [b.date, b]))
  for (const ride of rides) {
    const key = ride.borrowTime.slice(0, 10)
    const b = map.get(key)
    if (b) {
      b.trips += 1
      b.duration += ride.durationMin ?? 0
    }
  }
  return buckets
}

export function weeklyUsage(rides: Ride[]) {
  const data = DAY_LABELS.map((label) => ({ label, trips: 0 }))
  for (const ride of rides) {
    const d = new Date(ride.borrowTime)
    data[d.getUTCDay()].trips += 1
  }
  return data
}

export function peakHours(rides: Ride[]) {
  const data = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: `${h}:00`, trips: 0 }))
  for (const ride of rides) {
    const h = new Date(ride.borrowTime).getUTCHours()
    data[h].trips += 1
  }
  return data.filter((d) => d.hour >= 6 && d.hour <= 22)
}

export function topStations(rides: Ride[], stations: StationStats[], limit = 6) {
  const counts = new Map<string, number>()
  for (const ride of rides) {
    counts.set(ride.sourceStationId, (counts.get(ride.sourceStationId) ?? 0) + 1)
    if (ride.destStationId) counts.set(ride.destStationId, (counts.get(ride.destStationId) ?? 0) + 1)
  }
  return stations
    .map((s) => ({ name: s.shortName, trips: counts.get(s.id) ?? 0, utilization: s.utilization }))
    .sort((a, b) => b.trips - a.trips)
    .slice(0, limit)
}

export function topBikes(rides: Ride[], bikes: Bike[], limit = 6) {
  const counts = new Map<string, number>()
  for (const ride of rides) counts.set(ride.bikeId, (counts.get(ride.bikeId) ?? 0) + 1)
  return [...counts.entries()]
    .map(([bikeId, trips]) => ({ bikeId, trips, status: bikes.find((b) => b.id === bikeId)?.status ?? "available" }))
    .sort((a, b) => b.trips - a.trips)
    .slice(0, limit)
}

export function statusDistribution(bikes: Bike[]) {
  const available = bikes.filter((b) => b.status === "available").length
  const inUse = bikes.filter((b) => b.status === "in-use").length
  const maintenance = bikes.filter((b) => b.status === "maintenance").length
  return [
    { key: "available", label: "Available", value: available },
    { key: "in-use", label: "In Use", value: inUse },
    { key: "maintenance", label: "Maintenance", value: maintenance },
  ]
}

// ---------------------------------------------------------------------------
// Per-station analytics
// ---------------------------------------------------------------------------

/** Rides that either started or ended at the given station */
export function ridesForStation(rides: Ride[], stationId: string) {
  return rides.filter((r) => r.sourceStationId === stationId || r.destStationId === stationId)
}

export function stationSummary(rides: Ride[], stationId: string) {
  const borrows = rides.filter((r) => r.sourceStationId === stationId)
  const returns = rides.filter((r) => r.destStationId === stationId)
  const completed = borrows.filter((r) => r.durationMin != null)
  const avgDuration =
    completed.length === 0
      ? 0
      : Math.round(completed.reduce((sum, r) => sum + (r.durationMin ?? 0), 0) / completed.length)

  const hourCounts = new Array(24).fill(0)
  for (const r of borrows) hourCounts[new Date(r.borrowTime).getUTCHours()] += 1
  const busiestHour = hourCounts.indexOf(Math.max(...hourCounts))

  return {
    borrows: borrows.length,
    returns: returns.length,
    total: borrows.length + returns.length,
    avgDuration,
    busiestHour: borrows.length > 0 ? `${busiestHour}:00` : "—",
    /** positive = more bikes arriving than leaving */
    netFlow: returns.length - borrows.length,
  }
}

export function stationDailyUsage(rides: Ride[], stationId: string, days = 14) {
  const scoped = ridesForStation(rides, stationId)
  const buckets: { date: string; label: string; borrows: number; returns: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(REF.getTime() - i * 86400000)
    buckets.push({
      date: d.toISOString().slice(0, 10),
      label: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`,
      borrows: 0,
      returns: 0,
    })
  }
  const map = new Map(buckets.map((b) => [b.date, b]))
  for (const ride of scoped) {
    if (ride.sourceStationId === stationId) {
      const b = map.get(ride.borrowTime.slice(0, 10))
      if (b) b.borrows += 1
    }
    if (ride.destStationId === stationId && ride.returnTime) {
      const b = map.get(ride.returnTime.slice(0, 10))
      if (b) b.returns += 1
    }
  }
  return buckets
}

export function stationPeakHours(rides: Ride[], stationId: string) {
  const data = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: `${h}:00`, trips: 0 }))
  for (const ride of rides) {
    if (ride.sourceStationId !== stationId) continue
    data[new Date(ride.borrowTime).getUTCHours()].trips += 1
  }
  return data.filter((d) => d.hour >= 6 && d.hour <= 22)
}

/** Where riders go after borrowing from this station */
export function stationTopDestinations(
  rides: Ride[],
  stationId: string,
  stations: StationStats[],
  limit = 5,
) {
  const counts = new Map<string, number>()
  for (const ride of rides) {
    if (ride.sourceStationId !== stationId || !ride.destStationId) continue
    counts.set(ride.destStationId, (counts.get(ride.destStationId) ?? 0) + 1)
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  return [...counts.entries()]
    .map(([id, trips]) => ({
      id,
      name: stations.find((s) => s.id === id)?.shortName ?? id,
      trips,
      share: total === 0 ? 0 : Math.round((trips / total) * 100),
    }))
    .sort((a, b) => b.trips - a.trips)
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// Fleet health analytics
// ---------------------------------------------------------------------------

export function fleetHealth(bikes: Bike[]) {
  const avgCondition =
    bikes.length === 0
      ? 0
      : Math.round(bikes.reduce((sum, b) => sum + b.condition, 0) / bikes.length)
  const buckets = [
    { key: "good", label: "Good (70+)", value: bikes.filter((b) => b.condition >= 70).length },
    {
      key: "fair",
      label: "Fair (40–69)",
      value: bikes.filter((b) => b.condition >= 40 && b.condition < 70).length,
    },
    { key: "poor", label: "Poor (<40)", value: bikes.filter((b) => b.condition < 40).length },
  ]
  const serviceEvents = bikes.reduce((sum, b) => sum + b.serviceHistory.length, 0)
  const needsAttention = bikes
    .filter((b) => b.status !== "in-use")
    .sort((a, b) => a.condition - b.condition)
    .slice(0, 6)
  return { avgCondition, buckets, serviceEvents, needsAttention }
}

export function averageDuration(rides: Ride[]) {
  const completed = rides.filter((r) => r.durationMin != null)
  if (completed.length === 0) return 0
  return Math.round(completed.reduce((sum, r) => sum + (r.durationMin ?? 0), 0) / completed.length)
}

export function tripsToday(rides: Ride[]) {
  const today = REF.toISOString().slice(0, 10)
  return rides.filter((r) => r.borrowTime.slice(0, 10) === today).length
}

export function formatTimeAgo(iso: string) {
  const diff = REF.getTime() - new Date(iso).getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.round(hr / 24)
  return `${d}d ago`
}

/**
 * Short human-friendly code for an issue id. Demo issues already use
 * "ISS-XXXX" codes; database issues use UUIDs which we shorten for display.
 */
export function issueCode(id: string) {
  if (id.startsWith("ISS-")) return id
  return `ISS-${id.replace(/-/g, "").slice(0, 4).toUpperCase()}`
}

export function formatDateTime(iso: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  })
}
