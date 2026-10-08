import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import test from "node:test"
import vm from "node:vm"
import ts from "typescript"

const require = createRequire(import.meta.url)
const routeSource = ts.transpileModule(readFileSync(new URL("../app/auth/password/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const account = { id: "account-a", email: "student@nitt.edu", email_confirmed_at: "2026-10-09T00:00:00Z" }
const freshSession = { access_token: "test-only-session" }

function harness(overrides = {}) {
  const calls = []
  const settings = {
    configured: true,
    sessionUser: account,
    sessionError: null,
    passwordError: null,
    passwordUser: account,
    sendError: null,
    otpError: null,
    otpUser: account,
    otpSession: freshSession,
    updateError: null,
    signOutError: null,
    ...overrides,
  }
  const isolated = {
    auth: {
      async signInWithPassword(input) { calls.push(["password", input]); return { data: { user: settings.passwordUser }, error: settings.passwordError } },
      async resetPasswordForEmail(email) { calls.push(["send", email]); return { error: settings.sendError } },
      async verifyOtp(input) { calls.push(["verify", input]); return { data: { user: settings.otpUser, session: settings.otpSession }, error: settings.otpError } },
      async updateUser(input) { calls.push(["update", input]); return { error: settings.updateError } },
      async signOut(input) { calls.push(["signOut", input]); return { error: settings.signOutError } },
    },
  }
  const exports = {}
  const localRequire = (name) => {
    if (name === "@supabase/supabase-js") return { createClient: (_url, _key, options) => { calls.push(["client", options]); return isolated } }
    if (name === "@/lib/supabase/server") return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: settings.sessionUser }, error: settings.sessionError }) } }) }
    if (name === "@/lib/supabase/config") return {
      isSupabaseConfigured: settings.configured,
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_KEY: "test-only-public-key",
      isNittEmail: (email) => /^[^\s@]+@nitt\.edu$/i.test(email.trim()),
    }
    return require(name)
  }
  vm.runInNewContext(routeSource, { exports, require: localRequire, URL })
  return {
    calls,
    async post(body, headers = {}) {
      const request = new Request("https://cycle.test/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://cycle.test", host: "cycle.test", ...headers },
        body: JSON.stringify(body),
      })
      request.nextUrl = new URL(request.url)
      const response = await exports.POST(request)
      return { status: response.status, data: await response.json(), cache: response.headers.get("cache-control") }
    },
  }
}

const resetRequest = { action: "request", mode: "reset", email: account.email }
const resetUpdate = { action: "update", mode: "reset", email: account.email, token: "00123456", newPassword: "new-test-password", confirmPassword: "new-test-password" }
const changeUpdate = { ...resetUpdate, mode: "change", oldPassword: "old-test-password" }

test("recovery requests are generic, normalize email and use a nonpersistent client", async () => {
  const h = harness({ sendError: { code: "user_not_found" } })
  const response = await h.post({ ...resetRequest, email: " STUDENT@NITT.EDU " })
  assert.equal(response.status, 200)
  assert.match(response.data.message, /If a verified account exists/)
  assert.equal(response.cache, "no-store")
  assert.equal(h.calls.find(([name]) => name === "send")[1], account.email)
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0][1])), { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
})

test("reject cross-site requests and malformed actions without calling auth", async () => {
  const h = harness()
  assert.equal((await h.post(resetRequest, { origin: "https://evil.test" })).status, 403)
  assert.equal((await h.post(resetRequest, { "sec-fetch-site": "cross-site" })).status, 403)
  assert.equal((await h.post(resetRequest, { "content-type": "text/plain" })).status, 415)
  assert.equal((await h.post({ ...resetRequest, mode: "bypass" })).status, 400)
  assert.equal((await h.post(null)).status, 400)
  assert.equal(h.calls.length, 0)
})

test("reject noncampus email, malformed OTP, short password and mismatched confirmation", async () => {
  for (const body of [
    { ...resetRequest, email: "student@example.com" },
    { ...resetUpdate, token: "123456" },
    { ...resetUpdate, token: "abcdefgh" },
    { ...resetUpdate, newPassword: "short", confirmPassword: "short" },
    { ...resetUpdate, confirmPassword: "does-not-match" },
  ]) {
    const h = harness()
    assert.equal((await h.post(body)).status, 400)
    assert.equal(h.calls.length, 0)
  }
})

test("signed-in changes require a valid session and current password", async () => {
  const noSession = harness({ sessionUser: null })
  assert.equal((await noSession.post(changeUpdate)).status, 401)
  assert.equal(noSession.calls.length, 0)
  const noPassword = harness()
  assert.equal((await noPassword.post({ ...changeUpdate, oldPassword: "" })).status, 400)
  assert.equal(noPassword.calls.length, 0)
  const wrongPassword = harness({ passwordError: { code: "invalid_credentials", status: 400 } })
  assert.equal((await wrongPassword.post(changeUpdate)).status, 400)
  assert.equal(wrongPassword.calls.some(([name]) => name === "verify" || name === "update"), false)
})

test("wrong current password cannot send a change code", async () => {
  const h = harness({ passwordError: { code: "invalid_credentials", status: 400 } })
  assert.equal((await h.post({ ...resetRequest, mode: "change", oldPassword: "wrong-password" })).status, 400)
  assert.equal(h.calls.some(([name]) => name === "send"), false)
})

test("signed-in email comes from the verified session, not user input", async () => {
  const h = harness()
  assert.equal((await h.post({ ...changeUpdate, email: "another@nitt.edu" })).status, 200)
  assert.equal(h.calls.find(([name]) => name === "password")[1].email, account.email)
  assert.equal(h.calls.find(([name]) => name === "verify")[1].email, account.email)
  assert.deepEqual(h.calls.map(([name]) => name), ["client", "password", "signOut", "verify", "update", "signOut"])
})

test("invalid, expired or reused OTP never updates the password", async () => {
  const h = harness({ otpError: { code: "otp_expired", status: 403 } })
  const result = await h.post(resetUpdate)
  assert.equal(result.status, 400)
  assert.match(result.data.error, /invalid or has expired/)
  assert.equal(h.calls.some(([name]) => name === "update"), false)
})

test("verified recovery identity must match the requested email and account", async () => {
  for (const overrides of [
    { otpUser: { ...account, email: "another@nitt.edu" } },
    { otpUser: { ...account, email_confirmed_at: null } },
    { otpSession: null },
  ]) {
    const h = harness(overrides)
    assert.equal((await h.post(resetUpdate)).status, 403)
    assert.equal(h.calls.some(([name]) => name === "update"), false)
  }
  const wrongId = harness({ otpUser: { ...account, id: "another-id" } })
  assert.equal((await wrongId.post(changeUpdate)).status, 403)
  assert.equal(wrongId.calls.some(([name]) => name === "update"), false)
})

test("recovery verifies only recovery OTP, updates the password then revokes sessions without exposing credentials", async () => {
  const h = harness()
  const result = await h.post(resetUpdate)
  assert.equal(result.status, 200)
  assert.equal(result.data.success, true)
  assert.equal(result.data.sessionsRevoked, true)
  assert.equal(h.calls.find(([name]) => name === "verify")[1].type, "recovery")
  assert.equal(h.calls.find(([name]) => name === "verify")[1].token, "00123456")
  assert.equal(h.calls.find(([name]) => name === "update")[1].password, resetUpdate.newPassword)
  assert.equal(h.calls.at(-1)[1].scope, "global")
  assert.equal(JSON.stringify(result.data).includes("test-only-session"), false)
})

test("update failures consume the code and clean up the isolated session", async () => {
  const h = harness({ updateError: { code: "weak_password" } })
  const result = await h.post(resetUpdate)
  assert.equal(result.status, 400)
  assert.equal(result.data.codeConsumed, true)
  assert.equal(h.calls.at(-1)[1].scope, "local")
})

test("rate limits and delivery errors remain actionable", async () => {
  const limited = harness({ sendError: { status: 429 } })
  const result = await limited.post(resetRequest)
  assert.equal(result.status, 429)
  assert.equal(result.data.retryAfter, 60)
  const smtp = harness({ sendError: { code: "email_address_not_authorized" } })
  assert.equal((await smtp.post(resetRequest)).status, 503)
  const updateLimited = harness({ updateError: { status: 429 } })
  const updateResult = await updateLimited.post(resetUpdate)
  assert.equal(updateResult.status, 429)
  assert.equal(updateResult.data.codeConsumed, true)
})

test("failed global sign-out does not misreport a successful password change", async () => {
  const h = harness({ signOutError: { code: "unexpected_failure" } })
  const result = await h.post(resetUpdate)
  assert.equal(result.status, 200)
  assert.equal(result.data.success, true)
  assert.equal(result.data.sessionsRevoked, false)
})
