import type { UserRole } from "@/lib/types"

/**
 * DEMO / DUMMY AUTH — used ONLY when Supabase env vars are missing.
 *
 * Lets you test the full login/signup/logout flow right in the preview
 * without a database. The session is a simple (non-httpOnly) cookie.
 * When you connect your local Supabase later, this code is bypassed
 * entirely and real Supabase Auth takes over.
 */

export const DEMO_SESSION_COOKIE = "cyclenet-demo-session"

export interface DemoSession {
  id: string
  name: string
  email: string
  role: UserRole
  department: string
}

// Same test credentials that are seeded into Supabase (supabase/seed/004_test_users.sql)
export const DEMO_ACCOUNTS: Array<DemoSession & { password: string }> = [
  {
    id: "USR-0001",
    name: "Aarav Sharma",
    email: "106122045@nitt.edu",
    password: "Student@1234",
    role: "student",
    department: "CSE",
  },
  {
    id: "ADM-0001",
    name: "Dr. Priya Menon",
    email: "admin@nitt.edu",
    password: "Admin@1234",
    role: "admin",
    department: "Transport Office",
  },
]

/** Validate dummy credentials. Returns the session or an error message. */
export function demoSignIn(
  email: string,
  password: string,
): { session: DemoSession | null; error: string | null } {
  const account = DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === email.toLowerCase())
  if (!account || account.password !== password) {
    return { session: null, error: "Invalid email or password. Use the test credentials below." }
  }
  const { password: _pw, ...session } = account
  return { session, error: null }
}

/** Create a dummy student session for any @nitt.edu sign-up (no email confirmation in demo). */
export function demoSignUp(name: string, email: string): DemoSession {
  return {
    id: `USR-${email.split("@")[0].toUpperCase().slice(0, 8)}`,
    name: name.trim() || "NITT Student",
    email: email.toLowerCase(),
    role: "student",
    department: "—",
  }
}

/* ---------- client-side cookie helpers ---------- */

export function setDemoSessionCookie(session: DemoSession) {
  document.cookie = `${DEMO_SESSION_COOKIE}=${encodeURIComponent(
    JSON.stringify(session),
  )}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`
}

export function clearDemoSessionCookie() {
  document.cookie = `${DEMO_SESSION_COOKIE}=; path=/; max-age=0`
}

/** Parse a raw cookie value (server or client) back into a session. */
export function parseDemoSession(raw: string | undefined): DemoSession | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as DemoSession
    if (!parsed?.id || !parsed?.email || !parsed?.role) return null
    if (!parsed.email.toLowerCase().endsWith("@nitt.edu")) return null
    return parsed
  } catch {
    return null
  }
}
