import { createClient as createIsolatedClient, type AuthError } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isNittEmail, isSupabaseConfigured, SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/config"

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

function authFailure(error: AuthError, stage: "password" | "send" | "verify" | "update") {
  if (error.status === 429 || error.code?.includes("rate_limit")) {
    return reply({ error: "Too many attempts. Please wait before trying again.", retryAfter: 60, ...(stage === "update" ? { codeConsumed: true } : {}) }, 429)
  }
  if (error.code === "email_address_not_authorized") {
    return reply({ error: "Email delivery is not configured for this address. Please contact the campus administrator." }, 503)
  }
  if (stage === "password") {
    if (error.code === "invalid_credentials") return reply({ error: "The current password is incorrect. Try again or use email recovery." }, 400)
    return reply({ error: "Unable to verify your current password. Please try again later." }, 503)
  }
  if (stage === "verify") {
    if (error.code === "otp_expired" || error.status === 403 || error.status === 401) {
      return reply({ error: "The code is invalid or has expired. Use the latest code or request a new one." }, 400)
    }
    return reply({ error: "Unable to verify your code. Please try again later." }, 503)
  }
  if (stage === "update") {
    const message = error.code === "same_password"
      ? "Choose a password different from your current password. Request a fresh code to try again."
      : error.code === "weak_password"
        ? "Choose a stronger password that meets the project’s requirements. Request a fresh code to try again."
        : "The password was not changed. Request a fresh code before trying again."
    return reply({ error: message, codeConsumed: true }, 400)
  }
  return reply({ error: "Unable to send a recovery code. Please try again later." }, 503)
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin")
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  let originHost: string | null = null
  try { originHost = origin ? new URL(origin).host : null } catch { /* Reject malformed origins below. */ }
  if (!originHost || (originHost !== host && origin !== request.nextUrl.origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    return reply({ error: "This request is not allowed." }, 403)
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return reply({ error: "Send a JSON request." }, 415)
  }
  if (!isSupabaseConfigured) return reply({ error: "Authentication is currently unavailable." }, 503)

  try {
    if (Number(request.headers.get("content-length")) > 8192) return reply({ error: "Request is too large." }, 413)
    const text = await request.text()
    if (text.length > 8192) return reply({ error: "Request is too large." }, 413)
    let body: Record<string, unknown>
    try {
      const parsed: unknown = JSON.parse(text)
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reply({ error: "Invalid request." }, 400)
      body = parsed as Record<string, unknown>
    } catch {
      return reply({ error: "Invalid request." }, 400)
    }
    const { action, mode, oldPassword, token, newPassword, confirmPassword } = body
    if ((action !== "request" && action !== "update") || (mode !== "reset" && mode !== "change")) {
      return reply({ error: "Invalid password request." }, 400)
    }
    let email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    let expectedUserId: string | undefined
    if (mode === "change") {
      const sessionClient = await createClient()
      const userResult = sessionClient ? await sessionClient.auth.getUser() : null
      const user = userResult?.data.user
      if (userResult?.error || !user?.email || !user.email_confirmed_at || !isNittEmail(user.email)) {
        return reply({ error: "Your session has expired. Sign in again or use email recovery." }, 401)
      }
      email = user.email.trim().toLowerCase()
      expectedUserId = user.id
      if (typeof oldPassword !== "string" || !oldPassword || oldPassword.length > 1024) {
        return reply({ error: "Enter your current password, or choose email recovery if you forgot it." }, 400)
      }
    }
    if (email.length > 254 || !isNittEmail(email)) return reply({ error: "Enter a valid @nitt.edu college email address." }, 400)
    if (action === "update") {
      if (typeof token !== "string" || !/^\d{8}$/.test(token)) return reply({ error: "Enter the complete 8-digit email code." }, 400)
      if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 128) {
        return reply({ error: "Use a password between 8 and 128 characters." }, 400)
      }
      if (newPassword !== confirmPassword) return reply({ error: "The new passwords do not match." }, 400)
      if (mode === "change" && newPassword === oldPassword) return reply({ error: "Choose a password different from your current password." }, 400)
    }

    // Recovery credentials stay in this request, never in browser cookies or a shared server client.
    const supabase = createIsolatedClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    if (mode === "change") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: oldPassword as string })
      if (error) return authFailure(error, "password")
      if (data.user?.id !== expectedUserId) return reply({ error: "Unable to verify your account." }, 403)
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" })
      if (signOutError) return reply({ error: "Unable to complete password verification. Please try again." }, 503)
    }
    if (action === "request") {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error && error.code !== "user_not_found" && error.code !== "email_not_found") return authFailure(error, "send")
      return reply({ message: "If a verified account exists for this email, a recovery code has been requested. Check your inbox and spam folder.", retryAfter: 60 })
    }
    const { data, error } = await supabase.auth.verifyOtp({ email, token: token as string, type: "recovery" })
    if (error) return authFailure(error, "verify")
    if (!data.session || !data.user?.email_confirmed_at || data.user.email?.toLowerCase() !== email || (expectedUserId && data.user.id !== expectedUserId)) {
      await supabase.auth.signOut({ scope: "local" })
      return reply({ error: "Unable to verify your account. Request a new code.", codeConsumed: true }, 403)
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword as string })
    if (updateError) {
      await supabase.auth.signOut({ scope: "local" })
      return authFailure(updateError, "update")
    }
    const { error: signOutError } = await supabase.auth.signOut({ scope: "global" })
    return reply({ success: true, message: "Your password has been updated. Sign in with your new password.", sessionsRevoked: !signOutError })
  } catch {
    return reply({ error: "Unable to connect to authentication. Please try again." }, 503)
  }
}
