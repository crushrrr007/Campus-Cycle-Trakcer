import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import ts from "typescript"

const source = ts.transpileModule(readFileSync(new URL("../lib/donations.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const exports = {}
vm.runInNewContext(source, { exports, TextEncoder })
const { validateDonation, createDonationDraft, parseDonationDraft, validateAssessment } = exports
const details = {
  donorName: "Test Student", donorEmail: "student@nitt.edu", department: "Mechanical Engineering", phone: "",
  studyYear: "final-year", graduationYear: "2027", brand: "BSA", model: "Roadster", colour: "Blue",
  frameNumber: "", condition: "working", knownIssues: "", handoverLocation: "Hostel entrance",
  handoverDate: "2027-05-01", ownershipConfirmed: true,
}
const jsonDraft = (changes = {}) => JSON.stringify({ kind: "cyclenet-donation-draft", version: 1, createdAt: "2026-10-09T12:00:00Z", details: { ...details, ...changes } })

test("valid draft roundtrips, normalizes text and never contains a persisted ID", () => {
  assert.equal(Object.keys(validateDonation(details)).length, 0)
  const draft = createDonationDraft({ ...details, brand: " BSA ", donorEmail: "STUDENT@NITT.EDU" })
  const parsed = parseDonationDraft(JSON.stringify(draft))
  assert.equal(parsed.details.brand, "BSA")
  assert.equal(parsed.details.donorEmail, "student@nitt.edu")
  assert.equal(parsed.id, undefined)
  assert.equal(parsed.status, undefined)
})

test("requires ownership, campus identity, valid choices and real dates", () => {
  assert.ok(validateDonation({ ...details, ownershipConfirmed: false }).ownershipConfirmed)
  assert.ok(validateDonation({ ...details, donorEmail: "other@example.com" }).donorEmail)
  assert.ok(validateDonation({ ...details, studyYear: "admin" }).studyYear)
  assert.ok(validateDonation({ ...details, condition: "excellent" }).condition)
  assert.ok(validateDonation({ ...details, handoverDate: "2027-02-30" }).handoverDate)
  assert.ok(validateDonation({ ...details, handoverDate: "invalid" }).handoverDate)
  assert.ok(validateDonation({ ...details, graduationYear: "1999" }).graduationYear)
  assert.throws(() => createDonationDraft({ ...details, ownershipConfirmed: false }))
})

test("repairs and parts require useful descriptions, with bounded text and phone validation", () => {
  for (const condition of ["repair", "parts"]) {
    assert.ok(validateDonation({ ...details, condition }).knownIssues)
    assert.equal(Object.keys(validateDonation({ ...details, condition, knownIssues: "Needs rear brake repairs" })).length, 0)
  }
  assert.ok(validateDonation({ ...details, knownIssues: "x".repeat(1501) }).knownIssues)
  assert.ok(validateDonation({ ...details, phone: "not a phone" }).phone)
  assert.ok(validateDonation({ ...details, brand: "x".repeat(81) }).brand)
})

test("imports reject malformed, oversized, wrong-version and invalid documents", () => {
  for (const text of ["no-json", "null", "[]", "{}", jsonDraft({ donorName: null }), jsonDraft({ handoverDate: {} }), jsonDraft({ ownershipConfirmed: "true" }), jsonDraft({ department: {} })]) {
    assert.throws(() => parseDonationDraft(text))
  }
  assert.throws(() => parseDonationDraft(" ".repeat(65537)), /64 KB/)
  assert.throws(() => parseDonationDraft(JSON.stringify({ kind: "cyclenet-donation-draft", version: 2, details })))
  assert.throws(() => parseDonationDraft(JSON.stringify({ kind: "cyclenet-donation-assessment", version: 1, details })))
})

test("imported files cannot inject roles, IDs or executable HTML", () => {
  const parsed = parseDonationDraft(jsonDraft({ role: "admin", userId: "some-other-account", bikeId: "NITT-0001", donorName: "<script>alert(1)</script>" }))
  assert.equal(parsed.details.role, undefined)
  assert.equal(parsed.details.userId, undefined)
  assert.equal(parsed.details.bikeId, undefined)
  assert.equal(parsed.details.donorName, "<script>alert(1)</script>")
  const view = readFileSync(new URL("../components/donations/admin-donations-view.tsx", import.meta.url), "utf8")
  assert.equal(view.includes("dangerouslySetInnerHTML"), false)
})

test("fleet-ready assessment requires handover, safety clearance and notes", () => {
  const assessment = { outcome: "fleet", notes: "Cycle inspected", received: true, safetyChecked: true }
  assert.equal(validateAssessment(assessment), null)
  assert.match(validateAssessment({ ...assessment, received: false }), /handover/)
  assert.match(validateAssessment({ ...assessment, safetyChecked: false }), /safety inspection/)
  assert.match(validateAssessment({ ...assessment, notes: "" }), /notes/)
  assert.match(validateAssessment({ ...assessment, outcome: "unknown" }), /outcome/)
  assert.match(validateAssessment({ ...assessment, received: "true" }), /checks/)
  for (const outcome of ["repair", "parts", "decline"]) assert.equal(validateAssessment({ ...assessment, outcome, received: false, safetyChecked: false }), null)
})

test("donation routes preserve server-side authentication and admin authorization", () => {
  const adminLayout = readFileSync(new URL("../app/(app)/(admin)/layout.tsx", import.meta.url), "utf8")
  const appLayout = readFileSync(new URL("../app/(app)/layout.tsx", import.meta.url), "utf8")
  const studentPage = readFileSync(new URL("../app/(app)/donate/page.tsx", import.meta.url), "utf8")
  assert.match(adminLayout, /user\.role !== "admin"/)
  assert.match(adminLayout, /redirect\("\/dashboard"\)/)
  assert.match(appLayout, /if \(!sessionUser\) redirect\("\/sign-in"\)/)
  assert.match(studentPage, /if \(!user\) redirect\("\/sign-in"\)/)
})
