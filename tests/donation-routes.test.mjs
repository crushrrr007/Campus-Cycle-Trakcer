import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import ts from "typescript"

function loadModule(path, dependencies = {}) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  vm.runInNewContext(source, {
    exports, TextEncoder, TextDecoder, URL, Uint8Array, atob, btoa,
    require(name) {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`)
      return dependencies[name]
    },
  })
  return exports
}

const donations = loadModule("../lib/donations.ts")
const server = loadModule("../lib/donations-server.ts", {
  "server-only": {},
  "next/server": { NextResponse: { json: (body, init) => new Response(JSON.stringify(body), init) } },
})
const id = "00000000-0000-4000-8000-000000000001"
const student = { id: "student-id", role: "student", name: "Test Student", email: "student@nitt.edu" }
const details = {
  donorName: student.name, donorEmail: student.email, department: "CSE", phone: "",
  studyYear: "final-year", graduationYear: "2027", brand: "BSA", model: "Roadster", colour: "Blue",
  frameNumber: "", condition: "working", knownIssues: "", handoverLocation: "Hostel entrance",
  handoverDate: "2027-05-01", ownershipConfirmed: true,
}
const proof = {
  filename: "receipt.pdf", mimeType: "application/pdf", sizeBytes: Buffer.byteLength("%PDF-1.4\n%%EOF\n"),
  base64: Buffer.from("%PDF-1.4\n%%EOF\n").toString("base64"), ownerName: student.name, explanation: "",
}
const assessment = {
  outcome: "fleet", notes: "Cycle inspected", received: true, safetyChecked: true,
  ownershipVerified: true, ownershipNotes: "Student identity, receipt and bicycle match.",
}
const row = { id, details, assessment, created_at: "2026-10-09T12:00:00Z", reviewed_at: "2026-10-09T13:00:00Z" }
const context = { params: Promise.resolve({ id }) }

function request(method = "GET", body, path = "/api/donations") {
  const url = `http://localhost:3000${path}`
  return Object.assign(new Request(url, {
    method,
    headers: { "Content-Type": "application/json", origin: "http://localhost:3000", host: "localhost:3000", "sec-fetch-site": "same-origin" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }), { nextUrl: new URL(url) })
}

function mockClient(results = []) {
  const calls = []
  const finish = async () => {
    assert.ok(results.length, "Unexpected database operation")
    return results.shift()
  }
  const client = {
    from(table) {
      calls.push(["from", table])
      const query = {}
      for (const method of ["select", "eq", "is", "order", "update"]) {
        query[method] = (...args) => { calls.push([method, ...args]); return query }
      }
      query.range = (...args) => { calls.push(["range", ...args]); return finish() }
      query.maybeSingle = finish
      return query
    },
    rpc(name, parameters) { calls.push(["rpc", name, parameters]); return finish() },
  }
  return { client, calls }
}

function routes(user, client) {
  const dependencies = {
    "@/lib/donations": donations,
    "@/lib/donations-server": server,
    "@/lib/supabase/server": { createClient: async () => client },
    "@/lib/supabase/session": { getSessionUser: async () => user },
  }
  return {
    list: loadModule("../app/api/donations/route.ts", dependencies),
    item: loadModule("../app/api/donations/[id]/route.ts", dependencies),
  }
}

test("donation endpoints reject signed-out access and student admin access without querying storage", async () => {
  const { client, calls } = mockClient()
  const signedOut = routes(null, client)
  assert.equal((await signedOut.list.GET(request())).status, 401)
  assert.equal((await signedOut.list.POST(request("POST", {}))).status, 401)
  assert.equal((await signedOut.item.GET(request(), context)).status, 401)
  assert.equal((await signedOut.item.PATCH(request("PATCH", {}), context)).status, 401)
  const signedIn = routes(student, client)
  assert.equal((await signedIn.list.GET(request("GET", undefined, "/api/donations?scope=admin"))).status, 403)
  assert.equal((await signedIn.item.PATCH(request("PATCH", {}), context)).status, 403)
  assert.equal(calls.length, 0)
})

test("student inbox is owner-scoped and paginated without loading ownership documents", async () => {
  const { client, calls } = mockClient([{ data: Array.from({ length: 21 }, () => row), error: null }])
  const response = await routes(student, client).list.GET(request("GET", undefined, "/api/donations?page=2"))
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.donations.length, 20)
  assert.equal(body.hasMore, true)
  assert.ok(calls.some(call => call[0] === "eq" && call[1] === "user_id" && call[2] === student.id))
  assert.ok(calls.some(call => call[0] === "range" && call[1] === 40 && call[2] === 60))
  assert.equal(calls.some(call => call[0] === "from" && call[1] === "donation_proofs"), false)
  assert.equal(body.donations[0].ownershipProof, undefined)
  assert.match(response.headers.get("cache-control"), /private.*no-store/)
})

test("submission uses atomic RPC, trusted account identity and the same reference on retry", async () => {
  const { client, calls } = mockClient([{ error: null }, { error: null }])
  const route = routes(student, client).list
  const draft = donations.createDonationDraft({ ...details, donorName: "Impersonated", donorEmail: "other@nitt.edu" }, proof)
  for (let retry = 0; retry < 2; retry++) {
    const response = await route.POST(request("POST", { id, draft, role: "admin", userId: "someone-else" }))
    assert.equal(response.status, 201)
    assert.equal((await response.json()).id, id)
  }
  assert.equal(calls.length, 2)
  for (const call of calls) {
    assert.equal(call[0], "rpc")
    assert.equal(call[1], "submit_cycle_donation")
    assert.equal(call[2].p_id, id)
    assert.equal(call[2].p_details.donorName, student.name)
    assert.equal(call[2].p_details.donorEmail, student.email)
    assert.equal(call[2].p_proof.base64, proof.base64)
    assert.equal(call[2].p_details.role, undefined)
    assert.equal(call[2].p_details.userId, undefined)
  }
})

test("invalid submissions, cross-origin mutations and oversized JSON are rejected before storage", async () => {
  const { client, calls } = mockClient()
  const route = routes(student, client).list
  const draft = donations.createDonationDraft(details, proof)
  assert.equal((await route.POST(request("POST", { id: "invalid", draft }))).status, 400)
  assert.equal((await route.POST(request("POST", { id, draft: { ...draft, ownershipProof: undefined } }))).status, 400)
  const crossOrigin = request("POST", { id, draft })
  crossOrigin.headers.set("origin", "https://untrusted.example")
  crossOrigin.headers.set("sec-fetch-site", "cross-site")
  assert.equal((await route.POST(crossOrigin)).status, 403)
  await assert.rejects(server.readDonationJson(request("POST", { large: "x".repeat(100) }), 32), /large/)
  assert.equal(calls.length, 0)
})

test("admin acceptance requires stored proof and recorded ownership verification before any update", async () => {
  for (const [storedProof, review] of [[null, assessment], [proof, { ...assessment, ownershipVerified: false }]]) {
    const { client, calls } = mockClient([{ data: { id }, error: null }, { data: { proof: storedProof }, error: null }])
    const response = await routes({ ...student, role: "admin" }, client).item.PATCH(request("PATCH", { assessment: review, reviewedAt: null }), context)
    assert.equal(response.status, 400)
    assert.equal(calls.some(call => call[0] === "update"), false)
  }
})

test("admin review saves a sanitized assessment with optimistic concurrency and exposes the updated outcome", async () => {
  const { client, calls } = mockClient([
    { data: { id }, error: null }, { data: { proof }, error: null }, { data: row, error: null },
  ])
  const response = await routes({ ...student, role: "admin" }, client).item.PATCH(request("PATCH", {
    assessment: { ...assessment, notes: " Cycle inspected ", ownershipNotes: ` ${assessment.ownershipNotes} `, userId: "injected" },
    reviewedAt: null,
  }), context)
  assert.equal(response.status, 200)
  assert.equal((await response.json()).donation.assessment.outcome, "fleet")
  const update = calls.find(call => call[0] === "update")[1]
  assert.equal(update.assessment.notes, assessment.notes)
  assert.equal(update.assessment.ownershipNotes, assessment.ownershipNotes)
  assert.equal(update.assessment.userId, undefined)
  assert.ok(calls.some(call => call[0] === "is" && call[1] === "reviewed_at" && call[2] === null))
  assert.ok(calls.filter(call => call[0] === "from").every(call => ["donations", "donation_proofs"].includes(call[1])))
})

test("concurrent reviews return a conflict and failed submissions do not claim successful persistence", async () => {
  const conflict = mockClient([{ data: { id }, error: null }, { data: { proof }, error: null }, { data: null, error: null }])
  const response = await routes({ ...student, role: "admin" }, conflict.client).item.PATCH(request("PATCH", { assessment, reviewedAt: row.reviewed_at }), context)
  assert.equal(response.status, 409)
  assert.ok(conflict.calls.some(call => call[0] === "eq" && call[1] === "reviewed_at" && call[2] === row.reviewed_at))
  const unavailable = mockClient([{ error: { message: "private database error" } }])
  const failed = await routes(student, unavailable.client).list.POST(request("POST", { id, draft: donations.createDonationDraft(details, proof) }))
  assert.equal(failed.status, 503)
  const body = await failed.json()
  assert.equal(body.id, undefined)
  assert.equal(body.error.includes("private database error"), false)
})
