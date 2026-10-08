import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import ts from "typescript"

function loadModule(path, require = () => { throw new Error("Unexpected import") }) {
  const output = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const exports = {}
  vm.runInNewContext(output, { exports, require, URLSearchParams })
  return exports
}
const nav = loadModule("../lib/station-navigation.ts")
const analytics = loadModule("../lib/analytics.ts")
const origin = { lat: 10.76, lng: 78.81 }
const station = (id, fields = {}) => ({ ...origin, id, name: id, shortName: id, capacity: 10, occupied: 3, available: 2, stepThroughAvailable: 0, status: "active", ...fields })
const plain = (value) => JSON.parse(JSON.stringify(value))
const now = new Date("2026-10-09T19:00:00Z")
const ride = (time, fields = {}) => ({ borrowTime: time, returnTime: null, sourceStationId: "A", destStationId: null, durationMin: 10, ...fields })

test("borrow and return suitability are distinct, including maintenance occupancy", () => {
  const full = station("full", { occupied: 10, available: 9 })
  const empty = station("empty", { occupied: 0, available: 0 })
  assert.equal(nav.isUsableStation(full, "borrow"), true)
  assert.equal(nav.isUsableStation(full, "return"), false)
  assert.equal(nav.isUsableStation(empty, "borrow"), false)
  assert.equal(nav.isUsableStation(empty, "return"), true)
  assert.equal(nav.freeDocks(station("maintenance", { occupied: 8, available: 2 })), 2)
  assert.equal(nav.freeDocks(station("overflow", { occupied: 11 })), 0)
})

test("closed and offline stations are excluded for both purposes", () => {
  for (const purpose of ["borrow", "return"]) {
    assert.equal(nav.isUsableStation(station("closed", { capacity: 0 }), purpose), false)
    assert.equal(nav.isUsableStation(station("offline", { status: "offline" }), purpose), false)
  }
})

test("low-frame pickup requires verified available step-through bikes, but not for returns", () => {
  assert.equal(nav.isUsableStation(station("unknown"), "borrow", true), false)
  assert.equal(nav.isUsableStation(station("verified", { stepThroughAvailable: 1 }), "borrow", true), true)
  assert.equal(nav.isUsableStation(station("return"), "return", true), true)
})

test("nearest ranking excludes unusable stations and breaks ties consistently without mutation", () => {
  const stations = [station("far", { lat: 10.77 }), station("B"), station("A"), station("empty", { available: 0 }), station("invalid", { lat: NaN })]
  const before = stations.map((s) => s.id)
  assert.deepEqual(plain(nav.nearestUsableStations(stations, origin, "borrow").map((item) => item.station.id)), ["A", "B", "far"])
  assert.deepEqual(stations.map((s) => s.id), before)
  assert.equal(nav.nearestUsableStations(stations, origin, "borrow", true).length, 0)
})

test("distance calculation handles identical points and invalid coordinates", () => {
  assert.equal(nav.distanceMeters(origin, origin), 0)
  assert.ok(nav.distanceMeters(origin, { ...origin, lat: 10.77 }) > 1100)
  assert.ok(nav.distanceMeters(origin, { ...origin, lat: 10.77 }) < 1120)
  assert.equal(nav.validCoordinates({ lat: 91, lng: 0 }), false)
  assert.equal(nav.validCoordinates({ lat: 0, lng: Infinity }), false)
  assert.equal(nav.nearestUsableStations([station("A")], { lat: NaN, lng: 0 }, "borrow").length, 0)
})

test("directions contain coordinates, explicit walking mode, and the chosen origin", () => {
  const url = new URL(nav.directionsUrl(station("A"), origin))
  assert.equal(url.origin, "https://www.google.com")
  assert.equal(url.searchParams.get("origin"), "10.76,78.81")
  assert.equal(url.searchParams.get("travelmode"), "walking")
  assert.equal(url.searchParams.get("destination"), "10.76,78.81")
  assert.equal(new URL(nav.directionsUrl(station("A"))).searchParams.has("origin"), false)
})

test("campus day changes at 18:30 UTC rather than UTC midnight", () => {
  assert.equal(analytics.campusDateKey("2026-10-09T18:29:59Z"), "2026-10-09")
  assert.equal(analytics.campusDateKey("2026-10-09T18:30:00Z"), "2026-10-10")
  assert.equal(analytics.tripsToday([ride("2026-10-09T18:29:59Z"), ride("2026-10-09T18:30:00Z")], now), 1)
})

test("daily analytics use the current campus date and ignore older and invalid timestamps", () => {
  const data = analytics.dailyUsage([ride("2026-10-09T19:00:00Z"), ride("2026-06-14T09:00:00Z"), ride("invalid")], 2, now)
  assert.deepEqual(plain(data.map((b) => b.date)), ["2026-10-09", "2026-10-10"])
  assert.equal(data[1].trips, 1)
  assert.equal(data[1].duration, 10)
  assert.equal(data[0].trips, 0)
})

test("station daily returns use return time and cross campus-day boundaries correctly", () => {
  const data = analytics.stationDailyUsage([ride("2026-10-09T18:00:00Z", { returnTime: "2026-10-09T19:00:00Z", destStationId: "A" })], "A", 2, now)
  assert.equal(data[0].borrows, 1)
  assert.equal(data[0].returns, 0)
  assert.equal(data[1].returns, 1)
})

test("hourly and weekly grouping uses India Standard Time", () => {
  const rides = [ride("2026-10-09T00:30:00Z"), ride("invalid")]
  assert.equal(analytics.peakHours(rides).find((h) => h.hour === 6).trips, 1)
  assert.equal(analytics.stationPeakHours(rides, "A").find((h) => h.hour === 6).trips, 1)
  assert.equal(analytics.stationSummary([rides[0]], "A").busiestHour, "6:00")
  assert.equal(analytics.weeklyUsage([ride("2026-10-09T19:00:00Z")])[6].trips, 1)
})

test("relative times use actual elapsed time and tolerate future or invalid timestamps", () => {
  assert.equal(analytics.formatTimeAgo("2026-10-09T18:55:00Z", now), "5m ago")
  assert.equal(analytics.formatTimeAgo("2026-10-10T19:00:00Z", now), "just now")
  assert.equal(analytics.formatTimeAgo("invalid", now), "—")
  assert.match(analytics.formatDateTime("2026-10-09T00:30:00Z"), /06:00/)
})

function storeWithRpc(borrowRpc, returnRpc = async () => ({ ok: true, message: "Returned" })) {
  const context = { Provider: "provider" }
  const noop = () => {}
  const hookReact = {
    createContext: () => context,
    useCallback: (fn) => fn,
    useContext: () => context,
    useMemo: (fn) => fn(),
    useState: (initial) => [typeof initial === "function" ? initial() : initial, noop],
    useRef: (current) => ({ current }),
  }
  const store = loadModule("../lib/store.tsx", (name) => {
    if (name === "react") return hookReact
    if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }) }
    if (name === "swr") return { default: () => ({ data: [], mutate: async () => {}, isLoading: false }) }
    if (name === "./campus") return { STATION_DEFS: [] }
    if (name === "./data") return { seedData: () => ({ bikes: [], rides: [], notifications: [] }) }
    if (name === "./bike-frames") return { getFrameAvailability: () => ({}), isBikeFrameType: () => true }
    if (name === "./supabase/config") return { isSupabaseConfigured: true }
    if (name === "./use-notifications") return { useNotifications: () => ({ notifications: [], pushNotification: noop, markAllRead: noop, refreshNotifications: noop }) }
    if (name === "./rides-db") return { borrowBikeInDb: borrowRpc, returnBikeInDb: returnRpc }
    if (["./bikes-db", "./stations-db", "./issues-db"].includes(name)) return {}
    throw new Error(`Unexpected import ${name}`)
  })
  return store.StoreProvider({ children: null, sessionUser: { id: "user", name: "Test User", role: "student", email: "test@nitt.edu", department: "CSE" } }).props.value
}

test("rapid duplicate borrow and overlapping return submit only one RPC", async () => {
  let calls = 0
  let resolve
  const waiting = new Promise((done) => { resolve = done })
  const store = storeWithRpc(async () => { calls += 1; return waiting })
  const first = store.borrowBike("NITT-0001")
  assert.equal((await store.borrowBike("NITT-0001")).ok, false)
  assert.equal((await store.returnBike("NITT-0001", "A")).ok, false)
  assert.equal(calls, 1)
  resolve({ ok: true, message: "Borrowed" })
  assert.equal((await first).ok, true)
  assert.equal((await store.returnBike("NITT-0001", "A")).ok, true)
})

test("failed ride submissions release the shared guard for retry", async () => {
  let calls = 0
  const store = storeWithRpc(async () => {
    calls += 1
    if (calls === 1) throw new Error("Disconnected")
    return { ok: true, message: "Borrowed" }
  })
  await assert.rejects(store.borrowBike("NITT-0001"), /Disconnected/)
  assert.equal((await store.borrowBike("NITT-0001")).ok, true)
  assert.equal(calls, 2)
})

const userId = "11111111-1111-1111-1111-111111111111"
function notificationsDb(response = { data: [], error: null }) {
  const calls = []
  const chain = {}
  for (const name of ["select", "or", "order", "limit", "update", "eq"]) chain[name] = (...args) => { calls.push([name, ...args]); return chain }
  chain.then = (resolve, reject) => Promise.resolve(response).then(resolve, reject)
  const db = loadModule("../lib/notifications-db.ts", (name) => {
    assert.equal(name, "@/lib/supabase/client")
    return { createClient: () => ({ from: (name) => { calls.push(["from", name]); return chain } }) }
  })
  return { db, calls }
}

test("notification bell reads only the current user's alerts plus broadcasts even for admins", async () => {
  const { db, calls } = notificationsDb({ data: [{ id: "n", user_id: userId, type: "borrow", title: "Borrowed", message: "Receipt", read: false, created_at: "2026-10-09T00:00:00Z" }], error: null })
  const result = await db.fetchNotificationsFromDb(userId)
  assert.ok(calls.some(([name, value]) => name === "or" && value === `user_id.eq.${userId},user_id.is.null`))
  assert.ok(calls.some(([name, limit]) => name === "limit" && limit === 100))
  assert.equal(result[0].userId, userId)
  assert.equal(result[0].time, "2026-10-09T00:00:00Z")
})

test("mark-read writes only owned unread alerts, not shared broadcast rows", async () => {
  const { db, calls } = notificationsDb()
  await db.markPersonalNotificationsReadInDb(userId)
  assert.deepEqual(plain(calls.find(([name]) => name === "update")[1]), { read: true })
  assert.ok(calls.some(([name, column, value]) => name === "eq" && column === "user_id" && value === userId))
  assert.ok(calls.some(([name, column, value]) => name === "eq" && column === "read" && value === false))
})

test("notification queries reject malformed session ids and surface database failures", async () => {
  const { db, calls } = notificationsDb()
  await assert.rejects(db.fetchNotificationsFromDb("id,other.eq.value"))
  await assert.rejects(db.markPersonalNotificationsReadInDb("invalid"))
  assert.equal(calls.length, 0)
  const failed = notificationsDb({ data: null, error: { message: "denied" } })
  await assert.rejects(failed.db.fetchNotificationsFromDb(userId), /Unable to load/)
  await assert.rejects(failed.db.markPersonalNotificationsReadInDb(userId), /Unable to mark/)
})
