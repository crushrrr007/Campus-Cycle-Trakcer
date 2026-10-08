import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { createRequire } from "node:module"
import vm from "node:vm"
import ts from "typescript"
import * as jsxRuntime from "react/jsx-runtime"
import { renderToStaticMarkup } from "react-dom/server"

function loadModule(path, requireModule = () => { throw new Error("Unexpected import") }) {
  const output = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const exports = {}
  vm.runInNewContext(output, { exports, require: requireModule })
  return exports
}

const require = createRequire(import.meta.url)
function loadUI(path) {
  return loadModule(path, (name) => {
    if (name.startsWith("@/")) {
      const source = name.slice(2)
      return loadUI(`../${source}${source.startsWith("components/") ? ".tsx" : ".ts"}`)
    }
    return require(name)
  })
}

const frames = loadModule("../lib/bike-frames.ts")
const { isBikeFrameType, bikeFrameLabel, getFrameAvailability, needsStepThroughRestock } = frames
const bike = (frameType, stationId = "A", status = "available") => ({ frameType, stationId, status })
const count = (fleet, stationId) => JSON.parse(JSON.stringify(getFrameAvailability(fleet, stationId)))

function database(response = { data: [], error: null }) {
  const calls = []
  const chain = {
    select: (value) => { calls.push(["select", value]); return chain },
    order: () => Promise.resolve(response),
    insert: (value) => { calls.push(["insert", value]); return Promise.resolve(response) },
    update: (value) => { calls.push(["update", value]); return chain },
    eq: (key, value) => { calls.push(["eq", key, value]); return chain },
    then: (resolve, reject) => Promise.resolve(response).then(resolve, reject),
  }
  const exports = loadModule("../lib/bikes-db.ts", (name) => {
    if (name === "@/lib/bike-frames") return frames
    if (name === "@/lib/supabase/client") return { createClient: () => ({ from: () => chain }) }
    throw new Error(`Unexpected import: ${name}`)
  })
  return { ...exports, calls }
}

test("demo fleet has a deterministic 50/50 frame mix without changing other seed data", () => {
  const campus = loadModule("../lib/campus.ts")
  const requireSeedModule = (name) => {
    if (name === "./campus") return campus
    throw new Error(`Unexpected import: ${name}`)
  }
  const { seedData } = loadModule("../lib/data.ts", requireSeedModule)
  const seeded = seedData()
  assert.equal(seeded.bikes.length, 112)
  assert.equal(seeded.bikes.filter((bike) => bike.frameType === "step-through").length, 56)
  assert.equal(seeded.bikes.filter((bike) => bike.frameType === "step-over").length, 56)
  assert.equal(seeded.bikes.filter((bike) => bike.frameType === "unclassified").length, 0)
  assert.equal(JSON.stringify(seeded), JSON.stringify(seedData()))

  const originalSeedSource = readFileSync(new URL("../lib/data.ts", import.meta.url), "utf8")
    .replace('frameType: i % 2 === 1 ? "step-through" : "step-over"', 'frameType: "unclassified"')
  const output = ts.transpileModule(originalSeedSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const exports = {}
  vm.runInNewContext(output, { exports, require: requireSeedModule })
  const withoutFrames = (data) => ({
    ...data,
    bikes: data.bikes.map(({ frameType: _frameType, ...bike }) => bike),
  })
  assert.equal(JSON.stringify(withoutFrames(seeded)), JSON.stringify(withoutFrames(exports.seedData())))
})

test("frame types accept only explicit inspected classifications", () => {
  for (const value of ["unclassified", "step-through", "step-over"]) assert.equal(isBikeFrameType(value), true)
  for (const value of [null, undefined, "girls", "low-frame", "", {}, 1]) assert.equal(isBikeFrameType(value), false)
  assert.match(bikeFrameLabel("step-through"), /Step-through \/ low-frame/)
  assert.match(bikeFrameLabel("unclassified"), /inspection/)
})

test("frame badges allow full label height instead of clipping wrapped text", () => {
  const { BikeFrameBadge } = loadUI("../components/bike-frame-info.tsx")
  for (const frameType of ["step-through", "step-over", "unclassified"]) {
    const markup = renderToStaticMarkup(jsxRuntime.jsx(BikeFrameBadge, { frameType }))
    assert.ok(markup.includes(bikeFrameLabel(frameType)))
    assert.match(markup, /\bh-auto\b/)
    assert.match(markup, /\bwhitespace-normal\b/)
    assert.match(markup, /\bbreak-words\b/)
    assert.doesNotMatch(markup, /\bh-5\b/)
  }
})

test("station counts exclude maintenance, active rides, other stations and unclassified bikes from verified stock", () => {
  const fleet = [bike("step-through"), bike("step-over"), bike("unclassified"), bike(undefined), bike("step-through", "A", "maintenance"), bike("step-through", null, "in-use"), bike("step-through", "B")]
  assert.deepEqual(count(fleet, "A"), { stepThroughAvailable: 1, stepOverAvailable: 1, unclassifiedAvailable: 2 })
  assert.equal(count(fleet, "B").stepThroughAvailable, 1)
  assert.equal(count(fleet, "empty").stepThroughAvailable, 0)
})

test("borrowing, returning and relocating update verified coverage without changing classification", () => {
  const fleet = [bike("step-through")]
  assert.equal(count(fleet, "A").stepThroughAvailable, 1)
  fleet[0] = { ...fleet[0], status: "in-use", stationId: null }
  assert.equal(count(fleet, "A").stepThroughAvailable, 0)
  fleet[0] = { ...fleet[0], status: "available", stationId: "B" }
  assert.equal(count(fleet, "A").stepThroughAvailable, 0)
  assert.equal(count(fleet, "B").stepThroughAvailable, 1)
  fleet[0] = { ...fleet[0], stationId: "A" }
  assert.equal(count(fleet, "B").stepThroughAvailable, 0)
  assert.equal(count(fleet, "A").stepThroughAvailable, 1)
})

test("restock target ignores closed stations and requires at least one available low-frame bike", () => {
  assert.equal(needsStepThroughRestock({ capacity: 10, stepThroughAvailable: 0 }), true)
  assert.equal(needsStepThroughRestock({ capacity: 10, stepThroughAvailable: 1 }), false)
  assert.equal(needsStepThroughRestock({ capacity: 0, stepThroughAvailable: 0 }), false)
})

test("fleet fetch selects persisted frame types and maps unknown values safely", async () => {
  const row = { id: "NITT-0001", qr: "NITTBIKE:NITT-0001", status: "available", station_id: "A", model: "Cruiser", condition: 100, usage_count: 0, last_service_date: "2026-10-09", service_records: [] }
  const db = database({ data: [{ ...row, frame_type: "step-through" }, { ...row, frame_type: null }], error: null })
  const result = await db.fetchBikesFromDb()
  assert.match(db.calls[0][1], /frame_type/)
  assert.equal(result[0].frameType, "step-through")
  assert.equal(result[1].frameType, "unclassified")
})

test("registration and editing persist frame_type rather than a client-only field", async () => {
  const db = database({ data: [{ id: "NITT-0001" }], error: null })
  const value = { id: "NITT-0001", qr: "NITTBIKE:NITT-0001", frameType: "step-through", stationId: "A", model: "Cruiser", condition: 100, usageCount: 0, lastServiceDate: "2026-10-09", status: "available" }
  assert.equal((await db.createBikeInDb(value)).ok, true)
  assert.equal(db.calls.find(([action]) => action === "insert")[1].frame_type, "step-through")
  assert.equal((await db.updateBikeInDb(value.id, { frameType: "step-over" })).ok, true)
  assert.equal(db.calls.find(([action]) => action === "update")[1].frame_type, "step-over")
  assert.ok(db.calls.some(([action, column, id]) => action === "eq" && column === "id" && id === value.id))
})

test("invalid frame classifications cannot be saved", async () => {
  const db = database()
  assert.equal((await db.createBikeInDb({ frameType: "girls" })).ok, false)
  assert.equal((await db.updateBikeInDb("NITT-0001", { frameType: "invalid" })).ok, false)
  assert.equal(db.calls.length, 0)
})

test("frame edits retain admin-only RLS and detect filtered-out writes", async () => {
  const denied = database({ data: null, error: { code: "42501", message: "denied" } })
  assert.equal((await denied.updateBikeInDb("NITT-0001", { frameType: "step-through" })).ok, false)
  const filtered = database({ data: [], error: null })
  assert.equal((await filtered.updateBikeInDb("NITT-0001", { frameType: "step-through" })).ok, false)
})

function mapModule() {
  const health = loadModule("../lib/station-health.ts")
  const Container = ({ children, className }) => jsxRuntime.jsx("div", { className, children })
  const Marker = ({ title, children }) => jsxRuntime.jsx("div", { "aria-label": title, children })
  const Tooltip = ({ permanent, children }) => jsxRuntime.jsx("div", { "data-permanent": permanent, children })
  const Popup = ({ children }) => jsxRuntime.jsx("div", { "data-map-popup": true, children })
  return loadModule("../components/map/leaflet-map.tsx", (name) => {
    if (name === "react/jsx-runtime") return jsxRuntime
    if (name === "react") return { useMemo: (factory) => factory(), useEffect: () => {} }
    if (name === "react-leaflet") return { MapContainer: Container, Marker, Tooltip, Popup, TileLayer: () => null, ZoomControl: () => null, useMap: () => ({}) }
    if (name === "leaflet") return { default: { divIcon: (options) => options } }
    if (name === "leaflet/dist/leaflet.css") return {}
    if (name === "@/lib/station-health") return health
    throw new Error(`Unexpected map import: ${name}`)
  }).default
}

const mapStation = {
  id: "A", name: "Main Library", shortName: "Library", zone: "Academic", lat: 10.76, lng: 78.81,
  capacity: 12, occupied: 9, available: 7, stepThroughAvailable: 3, stepOverAvailable: 4, unclassifiedAvailable: 0,
}

function renderMap(station) {
  const Map = mapModule()
  return renderToStaticMarkup(Map({ stations: [station], selectedId: null, onSelect: () => {} }))
}

test("permanent map labels show only station names while popups retain frame counts", () => {
  const markup = renderMap(mapStation)
  assert.match(markup, /data-permanent="true"><span[^>]*>Library<\/span><\/div>/)
  assert.doesNotMatch(markup, /3 low .*4 high/)
  assert.match(markup, /Low-frame<\/dt><dd[^>]*>3<\/dd>/)
  assert.match(markup, /High-frame<\/dt><dd[^>]*>4<\/dd>/)
  assert.match(markup, /Main Library: 7 available, 3 low-frame, 4 high-frame, 0 awaiting frame inspection/)
  assert.match(markup, /Free docks<\/dt><dd[^>]*>3<\/dd>/)
  assert.doesNotMatch(markup, /Unclassified<\/dt>/)
})

test("map popups do not treat unclassified bikes as low or high", () => {
  const markup = renderMap({ ...mapStation, available: 2, occupied: 2, stepThroughAvailable: 0, stepOverAvailable: 0, unclassifiedAvailable: 2 })
  assert.match(markup, /Low-frame<\/dt><dd[^>]*>0<\/dd>/)
  assert.match(markup, /High-frame<\/dt><dd[^>]*>0<\/dd>/)
  assert.match(markup, /Unclassified<\/dt><dd[^>]*>2<\/dd>/)
  assert.match(markup, /0 low-frame, 0 high-frame, 2 awaiting frame inspection/)
})

test("map frame counts reflect borrowing, returning and maintenance status", () => {
  const fleet = [bike("step-through"), bike("step-over"), bike("step-through", "A", "maintenance")]
  const renderFleet = () => renderMap({ ...mapStation, ...count(fleet, "A") })
  const assertPopupCounts = (low, high) => {
    const markup = renderFleet()
    assert.match(markup, new RegExp(`Low-frame<\\/dt><dd[^>]*>${low}<\\/dd>`))
    assert.match(markup, new RegExp(`High-frame<\\/dt><dd[^>]*>${high}<\\/dd>`))
  }
  assertPopupCounts(1, 1)
  fleet[0] = { ...fleet[0], status: "in-use", stationId: null }
  assertPopupCounts(0, 1)
  fleet[0] = { ...fleet[0], status: "available", stationId: "A" }
  assertPopupCounts(1, 1)
})
