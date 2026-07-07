"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import * as React from "react"
import useSWR from "swr"
import { STATION_DEFS } from "./campus"
import { CURRENT_ADMIN, CURRENT_STUDENT, seedData } from "./data"
import { isSupabaseConfigured } from "./supabase/config"
import { createIssueInDb, fetchIssuesFromDb, updateIssueStatusInDb } from "./issues-db"
import {
  createStationInDb,
  deleteStationInDb,
  fetchStationsFromDb,
  updateStationInDb,
} from "./stations-db"
import {
  addServiceRecordInDb,
  createBikeInDb,
  deleteBikeInDb,
  fetchBikesFromDb,
  updateBikeInDb,
} from "./bikes-db"
import { borrowBikeInDb, fetchRidesFromDb, returnBikeInDb } from "./rides-db"
import type {
  AppNotification,
  AppUser,
  Bike,
  BikeStatus,
  IssueCategory,
  IssueReport,
  IssueStatus,
  Ride,
  Station,
  StationStatus,
  UserRole,
} from "./types"

export interface SessionUser {
  id: string
  name: string
  email: string
  role: UserRole
  department: string
}

export interface StationStats extends Station {
  available: number
  occupied: number
  inUse: number
  utilization: number
}

interface BorrowResult {
  ok: boolean
  message: string
  ride?: Ride
}

export interface ActionResult {
  ok: boolean
  message: string
}

interface StoreValue {
  bikes: Bike[]
  rides: Ride[]
  notifications: AppNotification[]
  issues: IssueReport[]
  myIssues: IssueReport[]
  role: UserRole
  setRole: (r: UserRole) => void
  /** true when no real Supabase session exists (in-memory demo mode) */
  isDemo: boolean
  currentUser: AppUser
  stations: StationStats[]
  activeRides: Ride[]
  myActiveRide: Ride | null
  myRides: Ride[]
  unreadCount: number
  // actions
  borrowBike: (bikeId: string) => Promise<BorrowResult>
  returnBike: (bikeId: string, destStationId: string) => Promise<BorrowResult>
  addBike: (data: Partial<Bike>) => Promise<string | null>
  updateBike: (id: string, data: Partial<Bike>) => Promise<ActionResult>
  deleteBike: (id: string) => Promise<ActionResult>
  moveBike: (bikeId: string, destStationId: string) => Promise<ActionResult>
  toggleMaintenance: (id: string) => Promise<void>
  logService: (bikeId: string, type: string, notes: string) => Promise<void>
  addStation: (data: Omit<Station, "status" | "id" | "x" | "y"> & { id?: string }) => Promise<ActionResult>
  updateStation: (id: string, data: Partial<Station>) => Promise<ActionResult>
  deleteStation: (id: string) => Promise<ActionResult>
  markAllRead: () => void
  getBike: (id: string) => Bike | undefined
  stationName: (id: string | null) => string
  reportIssue: (data: {
    bikeId: string | null
    stationId: string | null
    category: IssueCategory
    description: string
  }) => Promise<ActionResult>
  updateIssueStatus: (id: string, status: IssueStatus) => Promise<ActionResult>
}

const StoreContext = createContext<StoreValue | null>(null)

function computeStationStatus(available: number, capacity: number): StationStatus {
  if (capacity === 0) return "offline"
  if (available === 0) return "low"
  const ratio = available / capacity
  if (ratio >= 0.95) return "full"
  if (ratio <= 0.2) return "low"
  return "active"
}

let seqCounter = 9000

export function StoreProvider({
  children,
  sessionUser,
}: {
  children: React.ReactNode
  sessionUser?: SessionUser | null
}) {
  const seed = useMemo(() => seedData(), [])
  const [localBikes, setLocalBikes] = useState<Bike[]>(seed.bikes)
  const [localRides, setLocalRides] = useState<Ride[]>(seed.rides)
  const [notifications, setNotifications] = useState<AppNotification[]>(seed.notifications)
  // Demo-mode issues live in memory; real mode reads from Supabase below.
  const [localIssues, setLocalIssues] = useState<IssueReport[]>(() => [
    {
      id: "ISS-8003",
      userId: "USR-2091",
      userName: "Priya Raman",
      userEmail: "108122031@nitt.edu",
      bikeId: "NITT-0007",
      stationId: null,
      category: "brakes",
      description: "Rear brake squeals loudly and takes a long distance to stop.",
      status: "open",
      createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
    },
    {
      id: "ISS-8002",
      userId: "USR-2044",
      userName: "Arjun Mehta",
      userEmail: "103121087@nitt.edu",
      bikeId: "NITT-0012",
      stationId: "STN-GATE",
      category: "chain",
      description: "Chain slipped off twice near the main gate. Needs tensioning.",
      status: "in-review",
      createdAt: new Date(Date.now() - 26 * 3600_000).toISOString(),
    },
    {
      id: "ISS-8001",
      userId: "USR-2071",
      userName: "Sneha Iyer",
      userEmail: "110122019@nitt.edu",
      bikeId: null,
      stationId: "STN-GATE",
      category: "dock",
      description: "Dock #4 latch is jammed — bikes cannot be locked in properly.",
      status: "resolved",
      createdAt: new Date(Date.now() - 3 * 86400_000).toISOString(),
    },
  ])
  const [localStationDefs, setLocalStationDefs] = useState<Omit<Station, "status">[]>(STATION_DEFS)

  // Real mode: issues are persisted in Supabase. RLS scopes the result —
  // students only receive their own reports, admins receive everything.
  const realMode = Boolean(sessionUser) && isSupabaseConfigured
  const { data: dbIssues, mutate: mutateIssues } = useSWR(
    realMode ? "db-issues" : null,
    fetchIssuesFromDb,
    { revalidateOnFocus: true },
  )
  const issues = realMode ? (dbIssues ?? []) : localIssues

  // Real mode: stations are stored in and retrieved from Supabase. While the
  // first fetch is in flight we fall back to the seeded defs so the map is
  // never empty (the DB is seeded with the same stations).
  const { data: dbStations, mutate: mutateStations } = useSWR(
    realMode ? "db-stations" : null,
    fetchStationsFromDb,
    { revalidateOnFocus: true },
  )
  const stationDefs = realMode ? (dbStations ?? STATION_DEFS) : localStationDefs

  // Real mode: the bicycle fleet lives in Supabase. Borrow/return/move all
  // persist to the database and revalidate through SWR.
  const { data: dbBikes, mutate: mutateBikes } = useSWR(
    realMode ? "db-bikes" : null,
    fetchBikesFromDb,
    { revalidateOnFocus: true },
  )
  const bikes = realMode ? (dbBikes ?? []) : localBikes

  // Real mode: rides are persisted in Supabase. RLS scopes the result —
  // students only receive their own rides, admins receive everything.
  const { data: dbRides, mutate: mutateRides } = useSWR(
    realMode ? "db-rides" : null,
    fetchRidesFromDb,
    { revalidateOnFocus: true },
  )
  const rides = realMode ? (dbRides ?? []) : localRides

  // With a real Supabase session the role comes from the user's profile and
  // cannot be switched. In demo mode (no Supabase env vars) the role switch
  // in the topbar toggles between the two demo accounts.
  const [demoRole, setDemoRole] = useState<UserRole>("student")
  const role = sessionUser?.role ?? demoRole
  const setRole = useCallback(
    (r: UserRole) => {
      if (sessionUser) return // real users can't switch roles
      setDemoRole(r)
    },
    [sessionUser],
  )

  const currentUser = useMemo<AppUser>(() => {
    if (sessionUser) {
      return {
        id: sessionUser.id,
        name: sessionUser.name,
        email: sessionUser.email,
        role: sessionUser.role,
        department: sessionUser.department || "—",
        avatarFallback: sessionUser.name
          .split(" ")
          .map((w) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 2),
      }
    }
    return role === "admin" ? CURRENT_ADMIN : CURRENT_STUDENT
  }, [sessionUser, role])

  const stations = useMemo<StationStats[]>(() => {
    return stationDefs.map((def) => {
      const atStation = bikes.filter((b) => b.stationId === def.id)
      const available = atStation.filter((b) => b.status === "available").length
      const maintenance = atStation.filter((b) => b.status === "maintenance").length
      const occupied = available + maintenance
      const utilization = def.capacity > 0 ? Math.round((occupied / def.capacity) * 100) : 0
      return {
        ...def,
        available,
        occupied,
        inUse: 0,
        utilization,
        status: computeStationStatus(available, def.capacity),
      }
    })
  }, [bikes, stationDefs])

  const activeRides = useMemo(() => rides.filter((r) => r.status === "active"), [rides])

  const myActiveRide = useMemo(
    () => activeRides.find((r) => r.userId === currentUser.id) ?? null,
    [activeRides, currentUser.id],
  )

  const myRides = useMemo(
    () => rides.filter((r) => r.userId === currentUser.id),
    [rides, currentUser.id],
  )

  const unreadCount = notifications.filter((n) => !n.read).length

  const pushNotification = useCallback((n: Omit<AppNotification, "id" | "time" | "read">) => {
    setNotifications((prev) => [
      { ...n, id: `NTF-${seqCounter++}`, time: new Date().toISOString(), read: false },
      ...prev,
    ])
  }, [])

  const stationName = useCallback(
    (id: string | null) => stationDefs.find((s) => s.id === id)?.name ?? "—",
    [stationDefs],
  )

  const borrowBike = useCallback(
    async (bikeId: string): Promise<BorrowResult> => {
      // ── Real mode: atomic RPC in Supabase. The database enforces one active
      // ride per user and rejects unavailable bikes. ────────────────────────
      if (realMode) {
        const res = await borrowBikeInDb(bikeId)
        if (res.ok) {
          await Promise.all([mutateBikes(), mutateRides()])
          pushNotification({ type: "borrow", title: "Bicycle borrowed", message: res.message })
        }
        return res
      }

      // ── Demo mode: in-memory ──────────────────────────────────────────────
      const existing = rides.find((r) => r.status === "active" && r.userId === currentUser.id)
      if (existing)
        return {
          ok: false,
          message: `You already have ${existing.bikeId} checked out. Return it before borrowing another.`,
        }
      const bike = bikes.find((b) => b.id === bikeId || b.qr === bikeId)
      if (!bike) return { ok: false, message: `No bicycle found for "${bikeId}".` }
      if (bike.status === "maintenance")
        return { ok: false, message: `${bike.id} is under maintenance and cannot be borrowed.` }
      if (bike.status === "in-use")
        return { ok: false, message: `${bike.id} is currently in use.` }

      const src = bike.stationId
      const newRide: Ride = {
        id: `RIDE-${seqCounter++}`,
        bikeId: bike.id,
        userId: currentUser.id,
        userName: currentUser.name,
        sourceStationId: src ?? "STN-GATE",
        destStationId: null,
        borrowTime: new Date().toISOString(),
        returnTime: null,
        durationMin: null,
        status: "active",
      }
      setLocalBikes((prev) =>
        prev.map((b) =>
          b.id === bike.id ? { ...b, status: "in-use", stationId: null, usageCount: b.usageCount + 1 } : b,
        ),
      )
      setLocalRides((prev) => [newRide, ...prev])
      pushNotification({
        type: "borrow",
        title: "Bicycle borrowed",
        message: `${bike.id} borrowed from ${stationName(src)}.`,
      })
      return { ok: true, message: `${bike.id} is now yours. Ride safe!`, ride: newRide }
    },
    [bikes, rides, currentUser.id, currentUser.name, pushNotification, stationName, realMode, mutateBikes, mutateRides],
  )

  const returnBike = useCallback(
    async (bikeId: string, destStationId: string): Promise<BorrowResult> => {
      // ── Real mode: atomic RPC in Supabase (checks ownership + capacity) ───
      if (realMode) {
        const res = await returnBikeInDb(bikeId, destStationId)
        if (res.ok) {
          await Promise.all([mutateBikes(), mutateRides()])
          pushNotification({ type: "return", title: "Bicycle returned", message: res.message })
        }
        return res
      }

      // ── Demo mode: in-memory ──────────────────────────────────────────────
      const bike = bikes.find((b) => b.id === bikeId || b.qr === bikeId)
      if (!bike) return { ok: false, message: `No bicycle found for "${bikeId}".` }
      if (bike.status !== "in-use")
        return { ok: false, message: `${bike.id} is not currently checked out.` }

      const destStation = stationDefs.find((s) => s.id === destStationId)
      if (destStation) {
        const docked = bikes.filter((b) => b.stationId === destStationId).length
        if (docked >= destStation.capacity)
          return {
            ok: false,
            message: `${destStation.name} is full (${docked}/${destStation.capacity} docks). Choose another station.`,
          }
      }

      const ride = rides.find((r) => r.bikeId === bike.id && r.status === "active")
      const now = Date.now()
      const duration = ride ? Math.max(1, Math.round((now - new Date(ride.borrowTime).getTime()) / 60000)) : 1

      setLocalBikes((prev) =>
        prev.map((b) => (b.id === bike.id ? { ...b, status: "available", stationId: destStationId } : b)),
      )
      setLocalRides((prev) =>
        prev.map((r) =>
          r.id === ride?.id
            ? { ...r, destStationId, returnTime: new Date().toISOString(), durationMin: duration, status: "completed" }
            : r,
        ),
      )
      pushNotification({
        type: "return",
        title: "Bicycle returned",
        message: `${bike.id} returned to ${stationName(destStationId)} after ${duration} min.`,
      })
      return { ok: true, message: `${bike.id} returned. Ride duration: ${duration} min.` }
    },
    [bikes, rides, stationDefs, pushNotification, stationName, realMode, mutateBikes, mutateRides],
  )

  const addBike = useCallback(
    async (data: Partial<Bike>): Promise<string | null> => {
      // Derive a unique sequential id (max existing number + 1)
      const maxNum = bikes.reduce((max, b) => {
        const n = Number.parseInt(b.id.split("-")[1] ?? "0", 10)
        return Number.isNaN(n) ? max : Math.max(max, n)
      }, 0)
      const id = data.id ?? `NITT-${String(maxNum + 1).padStart(4, "0")}`
      const bike: Bike = {
        qr: `NITTBIKE:${id}`,
        status: "available",
        stationId: data.stationId ?? STATION_DEFS[0].id,
        usageCount: 0,
        lastServiceDate: new Date().toISOString(),
        serviceHistory: [],
        model: data.model ?? "NITT Cruiser",
        condition: data.condition ?? 100,
        ...data,
        id,
      }

      // ── Real mode: persist to Supabase (RLS: admins only) ─────────────────
      if (realMode) {
        const res = await createBikeInDb(bike)
        if (!res.ok) return null
        await mutateBikes()
      } else {
        setLocalBikes((prev) => [bike, ...prev])
      }

      pushNotification({
        type: "announcement",
        title: "Bicycle registered",
        message: `${id} (${bike.model}) added to ${stationName(bike.stationId)}.`,
      })
      return id
    },
    [bikes, pushNotification, stationName, realMode, mutateBikes],
  )

  const updateBike = useCallback(
    async (id: string, data: Partial<Bike>): Promise<ActionResult> => {
      // ── Real mode: persist to Supabase (RLS: admins only) ─────────────────
      if (realMode) {
        const res = await updateBikeInDb(id, data)
        if (res.ok) await mutateBikes()
        return res
      }
      setLocalBikes((prev) => prev.map((b) => (b.id === id ? { ...b, ...data } : b)))
      return { ok: true, message: "Bicycle updated." }
    },
    [realMode, mutateBikes],
  )

  const deleteBike = useCallback(
    async (id: string): Promise<ActionResult> => {
      const bike = bikes.find((b) => b.id === id)
      if (!bike) return { ok: false, message: `Bicycle ${id} not found.` }
      if (bike.status === "in-use")
        return { ok: false, message: `${id} is currently on a ride and cannot be removed.` }

      // ── Real mode: persist to Supabase (RLS: admins only) ─────────────────
      if (realMode) {
        const res = await deleteBikeInDb(id)
        if (res.ok) await mutateBikes()
        return res
      }

      setLocalBikes((prev) => prev.filter((b) => b.id !== id))
      return { ok: true, message: `${id} removed from the fleet.` }
    },
    [bikes, realMode, mutateBikes],
  )

  const moveBike = useCallback(
    async (bikeId: string, destStationId: string): Promise<ActionResult> => {
      const bike = bikes.find((b) => b.id === bikeId)
      if (!bike) return { ok: false, message: `Bicycle ${bikeId} not found.` }
      if (bike.status === "in-use")
        return { ok: false, message: `${bikeId} is on an active ride and cannot be relocated.` }
      if (bike.stationId === destStationId)
        return { ok: false, message: `${bikeId} is already docked at this station.` }

      const dest = stationDefs.find((s) => s.id === destStationId)
      if (!dest) return { ok: false, message: "Destination station not found." }
      const docked = bikes.filter((b) => b.stationId === destStationId).length
      if (docked >= dest.capacity)
        return {
          ok: false,
          message: `${dest.name} is full (${docked}/${dest.capacity} docks). Choose another station.`,
        }

      // ── Real mode: persist to Supabase (RLS: admins only) ─────────────────
      if (realMode) {
        const res = await updateBikeInDb(bikeId, { stationId: destStationId })
        if (!res.ok) return res
        await mutateBikes()
      } else {
        setLocalBikes((prev) =>
          prev.map((b) => (b.id === bikeId ? { ...b, stationId: destStationId } : b)),
        )
      }

      pushNotification({
        type: "announcement",
        title: "Bicycle relocated",
        message: `${bikeId} moved from ${stationName(bike.stationId)} to ${dest.name}.`,
      })
      return { ok: true, message: `${bikeId} moved to ${dest.name}.` }
    },
    [bikes, stationDefs, realMode, mutateBikes, pushNotification, stationName],
  )

  const logService = useCallback(
    async (bikeId: string, type: string, notes: string) => {
      const record = {
        id: `SVC-${seqCounter++}`,
        date: new Date().toISOString(),
        type,
        notes,
      }

      // ── Real mode: persist to Supabase (RLS: admins only) ─────────────────
      if (realMode) {
        const bike = bikes.find((b) => b.id === bikeId)
        const res = await addServiceRecordInDb(bikeId, type, notes)
        if (!res.ok) return
        await updateBikeInDb(bikeId, {
          lastServiceDate: record.date,
          condition: Math.min(100, (bike?.condition ?? 85) + 15),
        })
        await mutateBikes()
      } else {
        setLocalBikes((prev) =>
          prev.map((b) =>
            b.id === bikeId
              ? {
                  ...b,
                  serviceHistory: [record, ...b.serviceHistory],
                  lastServiceDate: record.date,
                  condition: Math.min(100, b.condition + 15),
                }
              : b,
          ),
        )
      }

      pushNotification({
        type: "maintenance",
        title: "Service logged",
        message: `${type} completed on ${bikeId}.`,
      })
    },
    [pushNotification, realMode, bikes, mutateBikes],
  )

  const toggleMaintenance = useCallback(
    async (id: string) => {
      // ── Real mode: persist to Supabase (RLS: admins only) ─────────────────
      if (realMode) {
        const bike = bikes.find((b) => b.id === id)
        if (!bike || bike.status === "in-use") return
        const next: BikeStatus = bike.status === "maintenance" ? "available" : "maintenance"
        const res = await updateBikeInDb(id, { status: next })
        if (!res.ok) return
        await mutateBikes()
      } else {
        setLocalBikes((prev) =>
          prev.map((b) => {
            if (b.id !== id) return b
            if (b.status === "maintenance") return { ...b, status: "available" as BikeStatus }
            if (b.status === "in-use") return b
            return { ...b, status: "maintenance" as BikeStatus }
          }),
        )
      }
      pushNotification({
        type: "maintenance",
        title: "Maintenance updated",
        message: `${id} maintenance status changed.`,
      })
    },
    [pushNotification, realMode, bikes, mutateBikes],
  )

  // Rough campus bounds used to derive legacy SVG x/y coordinates from lat/lng
  const CAMPUS_LAT_MAX = 10.7655
  const CAMPUS_LAT_MIN = 10.7558
  const CAMPUS_LNG_MIN = 78.8108
  const CAMPUS_LNG_MAX = 78.819

  const addStation = useCallback(
    async (data: Omit<Station, "status" | "id" | "x" | "y"> & { id?: string }): Promise<ActionResult> => {
      // Generate a unique id from the short name, e.g. "North Court" -> STN-NORTHCOURT
      const base = `STN-${data.shortName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10) || "NEW"}`
      let id = data.id ?? base
      let suffix = 2
      // Avoid collisions with existing ids
      // eslint-disable-next-line no-loop-func
      while (stationDefs.some((s) => s.id === id)) id = `${base}${suffix++}`

      const x = Math.round(((data.lng - CAMPUS_LNG_MIN) / (CAMPUS_LNG_MAX - CAMPUS_LNG_MIN)) * 1000)
      const y = Math.round(((CAMPUS_LAT_MAX - data.lat) / (CAMPUS_LAT_MAX - CAMPUS_LAT_MIN)) * 700)
      const def = { ...data, id, x, y }

      // ── Real mode: persist to Supabase ────────────────────────────────────
      if (realMode) {
        const res = await createStationInDb(def)
        if (!res.ok) return res
        await mutateStations()
      } else {
        setLocalStationDefs((prev) => [...prev, def])
      }

      pushNotification({
        type: "announcement",
        title: "Station added",
        message: `${data.name} (${data.capacity} docks) is now live in ${data.zone}.`,
      })
      return { ok: true, message: `${data.name} is now live with ${data.capacity} docks.` }
    },
    [stationDefs, pushNotification, realMode, mutateStations],
  )

  const updateStation = useCallback(
    async (id: string, data: Partial<Station>): Promise<ActionResult> => {
      // Keep the legacy SVG x/y in sync when the pin is moved
      const patch = { ...data }
      if (data.lat !== undefined && data.lng !== undefined) {
        patch.x = Math.round(((data.lng - CAMPUS_LNG_MIN) / (CAMPUS_LNG_MAX - CAMPUS_LNG_MIN)) * 1000)
        patch.y = Math.round(((CAMPUS_LAT_MAX - data.lat) / (CAMPUS_LAT_MAX - CAMPUS_LAT_MIN)) * 700)
      }

      // ── Real mode: persist to Supabase (optimistic — update UI instantly) ──
      if (realMode) {
        await mutateStations(
          (current) => (current ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)),
          { revalidate: false },
        )
        const res = await updateStationInDb(id, patch)
        if (!res.ok) {
          await mutateStations() // roll back to the server state
          return res
        }
        return res
      }

      setLocalStationDefs((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
      return { ok: true, message: "Station updated." }
    },
    [realMode, mutateStations],
  )

  const deleteStation = useCallback(
    async (id: string): Promise<ActionResult> => {
      const station = stationDefs.find((s) => s.id === id)
      if (!station) return { ok: false, message: `Station ${id} not found.` }
      const docked = bikes.filter((b) => b.stationId === id).length
      if (docked > 0)
        return {
          ok: false,
          message: `${station.name} still holds ${docked} bicycle${docked === 1 ? "" : "s"}. Move them to another station first.`,
        }

      // ── Real mode: persist to Supabase ────────────────────────────────────
      if (realMode) {
        const res = await deleteStationInDb(id)
        if (!res.ok) return res
        await mutateStations()
        return { ok: true, message: `${station.name} removed.` }
      }

      setLocalStationDefs((prev) => prev.filter((s) => s.id !== id))
      return { ok: true, message: `${station.name} removed.` }
    },
    [stationDefs, bikes, realMode, mutateStations],
  )

  const reportIssue = useCallback(
    async (data: {
      bikeId: string | null
      stationId: string | null
      category: IssueCategory
      description: string
    }): Promise<ActionResult> => {
      if (!data.description.trim())
        return { ok: false, message: "Please describe the problem so our team can fix it." }

      // ── Real mode: persist to Supabase ────────────────────────────────────
      if (realMode && sessionUser) {
        const res = await createIssueInDb({
          userId: sessionUser.id,
          bikeId: data.bikeId,
          stationId: data.stationId,
          category: data.category,
          description: data.description.trim(),
        })
        if (res.ok) {
          await mutateIssues() // refresh the list from the database
          pushNotification({
            type: "maintenance",
            title: "Issue reported",
            message: `Issue logged${data.bikeId ? ` for ${data.bikeId}` : ""}. The transport team will take a look.`,
          })
        }
        return res
      }

      // ── Demo mode: in-memory ──────────────────────────────────────────────
      if (data.bikeId) {
        const bike = bikes.find((b) => b.id === data.bikeId || b.qr === data.bikeId)
        if (!bike) return { ok: false, message: `No bicycle found for "${data.bikeId}".` }
      }

      const issue: IssueReport = {
        id: `ISS-${seqCounter++}`,
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        bikeId: data.bikeId,
        stationId: data.stationId,
        category: data.category,
        description: data.description.trim(),
        status: "open",
        createdAt: new Date().toISOString(),
      }
      setLocalIssues((prev) => [issue, ...prev])
      pushNotification({
        type: "maintenance",
        title: "Issue reported",
        message: `${issue.id} logged${data.bikeId ? ` for ${data.bikeId}` : ""}. The transport team will take a look.`,
      })
      return { ok: true, message: `Thanks! Issue ${issue.id} has been sent to the maintenance team.` }
    },
    [bikes, currentUser.id, currentUser.name, currentUser.email, pushNotification, realMode, sessionUser, mutateIssues],
  )

  const updateIssueStatus = useCallback(
    async (id: string, status: IssueStatus): Promise<ActionResult> => {
      // ── Real mode: persist to Supabase (RLS: admins only) ─────────────────
      if (realMode) {
        const res = await updateIssueStatusInDb(id, status)
        if (res.ok) {
          await mutateIssues()
          if (status === "resolved") {
            pushNotification({
              type: "maintenance",
              title: "Issue resolved",
              message: "An issue has been marked as resolved by the transport team.",
            })
          }
        }
        return res
      }

      // ── Demo mode: in-memory ──────────────────────────────────────────────
      setLocalIssues((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)))
      if (status === "resolved") {
        pushNotification({
          type: "maintenance",
          title: "Issue resolved",
          message: `${id} has been marked as resolved by the transport team.`,
        })
      }
      return { ok: true, message: `Issue marked as ${status.replace("-", " ")}.` }
    },
    [pushNotification, realMode, mutateIssues],
  )

  const myIssues = useMemo(
    () => issues.filter((i) => i.userId === currentUser.id),
    [issues, currentUser.id],
  )

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const getBike = useCallback((id: string) => bikes.find((b) => b.id === id || b.qr === id), [bikes])

  const value: StoreValue = {
    bikes,
    rides,
    notifications,
    role,
    setRole,
    isDemo: !sessionUser,
    currentUser,
    stations,
    activeRides,
    myActiveRide,
    myRides,
    unreadCount,
    borrowBike,
    returnBike,
    addBike,
    updateBike,
    deleteBike,
    moveBike,
    toggleMaintenance,
    logService,
    addStation,
    updateStation,
    deleteStation,
    markAllRead,
    getBike,
    stationName,
    issues,
    myIssues,
    reportIssue,
    updateIssueStatus,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useStore must be used within StoreProvider")
  return ctx
}
