import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import ts from "typescript"

const source = ts.transpileModule(readFileSync(new URL("../lib/donations.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const exports = {}
vm.runInNewContext(source, { exports, TextEncoder, atob, btoa })
const { validateDonation, createDonationDraft, parseDonationDraft, validateAssessment, validateOwnershipProof, readOwnershipProof, MAX_DONATION_FILE_BYTES, MAX_OWNERSHIP_PROOF_BYTES } = exports
const proof = {
  filename: "receipt.pdf", mimeType: "application/pdf", sizeBytes: Buffer.byteLength("%PDF-1.4\n%%EOF\n"),
  base64: Buffer.from("%PDF-1.4\n%%EOF\n").toString("base64"),
  ownerName: "Test Student", explanation: "",
}
const details = {
  donorName: "Test Student", donorEmail: "student@nitt.edu", department: "Mechanical Engineering", phone: "",
  studyYear: "final-year", graduationYear: "2027", brand: "BSA", model: "Roadster", colour: "Blue",
  frameNumber: "", condition: "working", knownIssues: "", handoverLocation: "Hostel entrance",
  handoverDate: "2027-05-01", ownershipConfirmed: true,
}
const jsonDraft = (changes = {}) => JSON.stringify({ kind: "cyclenet-donation-draft", version: 1, createdAt: "2026-10-09T12:00:00Z", details: { ...details, ...changes } })

test("valid draft roundtrips, normalizes text and never contains a persisted ID", () => {
  assert.equal(Object.keys(validateDonation(details)).length, 0)
  const draft = createDonationDraft({ ...details, brand: " BSA ", donorEmail: "STUDENT@NITT.EDU" }, proof)
  const parsed = parseDonationDraft(JSON.stringify(draft))
  assert.equal(parsed.details.brand, "BSA")
  assert.equal(parsed.details.donorEmail, "student@nitt.edu")
  assert.equal(parsed.id, undefined)
  assert.equal(parsed.status, undefined)
  assert.equal(parsed.version, 2)
  assert.equal(parsed.ownershipProof.base64, proof.base64)
  assert.equal(parsed.ownershipProof.ownerName, details.donorName)
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
  assert.throws(() => parseDonationDraft(" ".repeat(MAX_DONATION_FILE_BYTES + 1)), /3 MB/)
  assert.throws(() => parseDonationDraft(JSON.stringify({ kind: "cyclenet-donation-draft", version: 3, details })))
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

test("all acceptance pathways require valid proof, manual verification and recorded findings", () => {
  const assessment = { outcome: "fleet", notes: "Cycle inspected", received: true, safetyChecked: true, ownershipVerified: true, ownershipNotes: "Student ID matches receipt; model and frame number match the cycle." }
  assert.equal(validateAssessment(assessment, proof), null)
  assert.match(validateAssessment({ ...assessment, received: false }, proof), /handover/)
  assert.match(validateAssessment({ ...assessment, safetyChecked: false }, proof), /safety inspection/)
  assert.match(validateAssessment({ ...assessment, notes: "" }, proof), /notes/)
  assert.match(validateAssessment({ ...assessment, outcome: "unknown" }, proof), /outcome/)
  assert.match(validateAssessment({ ...assessment, received: "true" }, proof), /checks/)
  for (const outcome of ["fleet", "repair", "parts"]) {
    assert.match(validateAssessment({ ...assessment, outcome }), /proof/)
    assert.match(validateAssessment({ ...assessment, outcome }, { ...proof, base64: "bad" }), /proof/)
    assert.match(validateAssessment({ ...assessment, outcome, ownershipVerified: false }, proof), /identity/)
    assert.match(validateAssessment({ ...assessment, outcome, ownershipVerified: "true" }, proof), /checks/)
    assert.match(validateAssessment({ ...assessment, outcome, ownershipNotes: "" }, proof), /matched/)
  }
  for (const outcome of ["repair", "parts"]) assert.equal(validateAssessment({ ...assessment, outcome, received: false, safetyChecked: false }, proof), null)
  assert.equal(validateAssessment({ ...assessment, outcome: "decline", received: false, safetyChecked: false, ownershipVerified: false, ownershipNotes: "" }), null)
})

test("new drafts require proof while legacy drafts can be inspected but not accepted", () => {
  assert.throws(() => createDonationDraft(details, null), /Attach/)
  assert.throws(() => createDonationDraft(details, { ...proof, ownerName: "" }), /owner/)
  const legacy = parseDonationDraft(jsonDraft())
  assert.equal(legacy.version, 1)
  assert.equal(legacy.ownershipProof, undefined)
  const exported = createDonationDraft(details, proof)
  assert.throws(() => parseDonationDraft(JSON.stringify({ ...exported, ownershipProof: undefined })), /Attach/)
  assert.throws(() => parseDonationDraft(JSON.stringify({ ...exported, ownershipProof: { ...proof, base64: "invalid" } })), /invalid/)
  const parsed = parseDonationDraft(JSON.stringify({ ...exported, ownershipProof: { ...proof, verified: true, url: "javascript:alert(1)" } }))
  assert.equal(parsed.ownershipProof.verified, undefined)
  assert.equal(parsed.ownershipProof.url, undefined)
})

test("ownership documents have bounded data, safe filenames and matching file signatures", () => {
  assert.equal(validateOwnershipProof(proof), null)
  for (const change of [
    { mimeType: "image/svg+xml" }, { mimeType: "text/html" }, { mimeType: "toString" },
    { filename: "../../receipt.pdf" }, { filename: "bad\\u0000.pdf" },
    { ownerName: " " }, { explanation: "x".repeat(1001) },
    { sizeBytes: MAX_OWNERSHIP_PROOF_BYTES + 1 }, { sizeBytes: 0 }, { sizeBytes: 1.5 },
    { base64: "data:application/pdf;base64," + proof.base64 }, { base64: "x".repeat(proof.base64.length) },
    { mimeType: "image/png" }, { mimeType: "image/jpeg" },
  ]) assert.ok(validateOwnershipProof({ ...proof, ...change }))
  for (const [mimeType, signature] of [["image/png", [137, 80, 78, 71, 13, 10, 26, 10]], ["image/jpeg", [255, 216, 255]]]) {
    const bytes = Buffer.from(signature)
    assert.equal(validateOwnershipProof({ ...proof, mimeType, sizeBytes: bytes.length, base64: bytes.toString("base64") }), null)
  }
})

test("maximum-size attachment validates and fits inside the draft limit", () => {
  const bytes = Buffer.alloc(MAX_OWNERSHIP_PROOF_BYTES)
  bytes.write("%PDF-1.4")
  const attachment = { ...proof, sizeBytes: bytes.length, base64: bytes.toString("base64") }
  assert.equal(validateOwnershipProof(attachment), null)
  const draft = createDonationDraft(details, attachment)
  const json = JSON.stringify(draft)
  assert.ok(Buffer.byteLength(json) < MAX_DONATION_FILE_BYTES)
  assert.equal(parseDonationDraft(json).ownershipProof.sizeBytes, bytes.length)
})

test("file reads reject unsupported and oversized evidence and preserve valid bytes", async () => {
  const bytes = Buffer.from("%PDF-1.4\n%%EOF\n")
  const file = { name: "receipt.pdf", type: "application/pdf", size: bytes.length, arrayBuffer: async () => Uint8Array.from(bytes).buffer }
  const uploaded = await readOwnershipProof(file)
  assert.equal(uploaded.base64, proof.base64)
  assert.equal(uploaded.ownerName, "")
  await assert.rejects(readOwnershipProof({ ...file, size: MAX_OWNERSHIP_PROOF_BYTES + 1 }), /2 MB/)
  await assert.rejects(readOwnershipProof({ ...file, type: "text/html" }), /PDF/)
  await assert.rejects(readOwnershipProof({ ...file, type: "image/png" }), /contents/)
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
