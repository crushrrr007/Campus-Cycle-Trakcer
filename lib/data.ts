import { STATION_DEFS } from "./campus"
import type { AppNotification, Bike, Ride, ServiceRecord } from "./types"

// Deterministic PRNG (mulberry32) so server and client render identical data.
function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T,>(r: () => number, arr: T[]): T => arr[Math.floor(r() * arr.length)]
const randInt = (r: () => number, min: number, max: number) => Math.floor(r() * (max - min + 1)) + min

const FIRST = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna", "Ishaan", "Rohan",
  "Ananya", "Diya", "Aadhya", "Saanvi", "Pari", "Anika", "Navya", "Riya", "Myra", "Kiara",
  "Karthik", "Harini", "Lakshmi", "Meena", "Surya", "Divya", "Nithya", "Pranav", "Tara", "Varun",
]
const LAST = [
  "Sharma", "Verma", "Iyer", "Nair", "Reddy", "Menon", "Patel", "Rao", "Krishnan", "Pillai",
  "Gupta", "Bose", "Das", "Joshi", "Kumar", "Subramanian", "Chandran", "Mehta", "Venkat", "Raman",
]
const DEPTS = ["CSE", "ECE", "Mech", "Civil", "EEE", "Chemical", "Metallurgy", "Production", "ICE", "Architecture"]
const MODELS = ["NITT Cruiser", "Campus Sprint", "EcoRide City", "TrailMate Lite", "UrbanGlide"]
const SERVICE_TYPES = ["Brake adjustment", "Tyre replacement", "Chain lube", "Gear tuning", "Full inspection", "Seat repair"]

const DAY = 86400000
const NOW = Date.UTC(2026, 5, 14, 9, 30, 0) // fixed reference: 14 Jun 2026 09:30 UTC

function isoFromOffset(msAgo: number) {
  return new Date(NOW - msAgo).toISOString()
}

export interface SeedData {
  bikes: Bike[]
  rides: Ride[]
  notifications: AppNotification[]
}

export function seedData(): SeedData {
  const r = rng(20260614)
  const stationIds = STATION_DEFS.map((s) => s.id)
  const bikes: Bike[] = []
  const rides: Ride[] = []

  const TOTAL = 112
  // Decide statuses up front.
  const maintenanceCount = 7
  const inUseCount = 14

  for (let i = 1; i <= TOTAL; i++) {
    const id = `NITT-${String(i).padStart(4, "0")}`
    const usageCount = randInt(r, 18, 240)
    const lastServiceDays = randInt(r, 1, 90)
    const serviceHistory: ServiceRecord[] = []
    const svcN = randInt(r, 1, 4)
    for (let s = 0; s < svcN; s++) {
      serviceHistory.push({
        id: `${id}-SVC-${s}`,
        date: isoFromOffset((lastServiceDays + s * randInt(r, 20, 60)) * DAY),
        type: pick(r, SERVICE_TYPES),
        notes: pick(r, ["Routine maintenance completed.", "Replaced worn parts.", "Reported by student.", "Preventive check."]),
      })
    }

    bikes.push({
      id,
      qr: `NITTBIKE:${id}`,
      status: "available",
      stationId: pick(r, stationIds),
      usageCount,
      lastServiceDate: isoFromOffset(lastServiceDays * DAY),
      serviceHistory,
      model: pick(r, MODELS),
      condition: randInt(r, 55, 99),
    })
  }

  // Assign maintenance bikes.
  for (let i = 0; i < maintenanceCount; i++) {
    bikes[randInt(r, 0, TOTAL - 1)].status = "maintenance"
  }

  // Build historical rides over the last 30 days.
  const rideNames: { id: string; name: string }[] = []
  for (let i = 0; i < 40; i++) {
    const name = `${pick(r, FIRST)} ${pick(r, LAST)}`
    rideNames.push({ id: `USR-${String(1000 + i)}`, name })
  }

  let rideSeq = 5000
  const historyCount = 460
  for (let i = 0; i < historyCount; i++) {
    const daysAgo = randInt(r, 0, 29)
    const hour = pickWeightedHour(r)
    const minute = randInt(r, 0, 59)
    const borrowMsAgo = daysAgo * DAY - hour * 3600000 - minute * 60000 + 12 * 3600000
    if (borrowMsAgo < 0) continue
    const duration = randInt(r, 4, 55)
    let src = pick(r, stationIds)
    let dest = pick(r, stationIds)
    if (dest === src) dest = stationIds[(stationIds.indexOf(src) + 1) % stationIds.length]
    const u = pick(r, rideNames)
    rides.push({
      id: `RIDE-${rideSeq++}`,
      bikeId: bikes[randInt(r, 0, TOTAL - 1)].id,
      userId: u.id,
      userName: u.name,
      sourceStationId: src,
      destStationId: dest,
      borrowTime: isoFromOffset(borrowMsAgo),
      returnTime: isoFromOffset(borrowMsAgo - duration * 60000),
      durationMin: duration,
      status: "completed",
    })
  }
  // Personal ride history for the demo student (USR-0001) so their dashboard is populated.
  for (let i = 0; i < 11; i++) {
    const daysAgo = randInt(r, 0, 24)
    const hour = pickWeightedHour(r)
    const minute = randInt(r, 0, 59)
    const borrowMsAgo = daysAgo * DAY - hour * 3600000 - minute * 60000 + 12 * 3600000
    if (borrowMsAgo < 0) continue
    const duration = randInt(r, 6, 34)
    let src = pick(r, stationIds)
    let dest = pick(r, stationIds)
    if (dest === src) dest = stationIds[(stationIds.indexOf(src) + 1) % stationIds.length]
    rides.push({
      id: `RIDE-${rideSeq++}`,
      bikeId: bikes[randInt(r, 0, TOTAL - 1)].id,
      userId: "USR-0001",
      userName: "Aarav Sharma",
      sourceStationId: src,
      destStationId: dest,
      borrowTime: isoFromOffset(borrowMsAgo),
      returnTime: isoFromOffset(borrowMsAgo - duration * 60000),
      durationMin: duration,
      status: "completed",
    })
  }

  rides.sort((a, b) => new Date(b.borrowTime).getTime() - new Date(a.borrowTime).getTime())

  // Active rides: take available bikes and mark in-use.
  const availableForActive = bikes.filter((b) => b.status === "available")
  for (let i = 0; i < inUseCount && i < availableForActive.length; i++) {
    const bike = availableForActive[i]
    bike.status = "in-use"
    const src = bike.stationId ?? pick(r, stationIds)
    bike.stationId = null
    const u = pick(r, rideNames)
    const minsAgo = randInt(r, 2, 42)
    rides.unshift({
      id: `RIDE-${rideSeq++}`,
      bikeId: bike.id,
      userId: u.id,
      userName: u.name,
      sourceStationId: src,
      destStationId: null,
      borrowTime: isoFromOffset(minsAgo * 60000),
      returnTime: null,
      durationMin: null,
      status: "active",
    })
  }

  const notifications = seedNotifications(r)
  return { bikes, rides, notifications }
}

// Peak hours weighting: morning (8-10) and evening (16-19) busiest.
function pickWeightedHour(r: () => number) {
  const buckets = [
    ...Array(2).fill(7), ...Array(6).fill(8), ...Array(7).fill(9), ...Array(4).fill(10),
    ...Array(2).fill(11), ...Array(3).fill(12), ...Array(3).fill(13), ...Array(2).fill(14),
    ...Array(3).fill(15), ...Array(6).fill(16), ...Array(7).fill(17), ...Array(6).fill(18),
    ...Array(3).fill(19), ...Array(2).fill(20), ...Array(1).fill(21),
  ]
  return pick(r, buckets)
}

function seedNotifications(r: () => number): AppNotification[] {
  const base: Omit<AppNotification, "id" | "time" | "read">[] = [
    { type: "low-stock", title: "Low availability", message: "Cafeteria Station is running low — only 2 bikes left." },
    { type: "full", title: "Station full", message: "Main Gate Station has reached full capacity." },
    { type: "maintenance", title: "Maintenance alert", message: "NITT-0042 flagged for brake inspection." },
    { type: "announcement", title: "Campus announcement", message: "New bicycle station planned near the Innovation Center." },
    { type: "borrow", title: "Bicycle borrowed", message: "NITT-0019 borrowed from Library Station." },
    { type: "return", title: "Bicycle returned", message: "NITT-0007 returned to Boys Hostel Station." },
    { type: "maintenance", title: "Service due", message: "12 bicycles are due for routine service this week." },
    { type: "announcement", title: "Peak hours", message: "Expect high demand between 8–10 AM near hostels." },
  ]
  return base.map((n, i) => ({
    ...n,
    id: `NTF-${i}`,
    time: isoFromOffset(randInt(r, 2, 600) * 60000),
    read: i > 3,
  }))
}

export const CURRENT_STUDENT = {
  id: "USR-0001",
  name: "Aarav Sharma",
  email: "106122045@nitt.edu",
  role: "student" as const,
  department: "CSE",
  avatarFallback: "AS",
}

export const CURRENT_ADMIN = {
  id: "ADM-0001",
  name: "Dr. Priya Menon",
  email: "priya.m@nitt.edu",
  role: "admin" as const,
  department: "Transport Office",
  avatarFallback: "PM",
}
