import { cookies } from "next/headers"
import { createClient } from "./server"
import { isSupabaseConfigured } from "./config"
import { DEMO_SESSION_COOKIE, parseDemoSession } from "@/lib/demo-auth"
import type { UserRole } from "@/lib/types"

export interface SessionUser {
  id: string
  name: string
  email: string
  role: UserRole
  department: string
}

/**
 * Reads the current Supabase session and the user's profile (role lives in
 * public.profiles, never in client-editable metadata).
 * Returns null when signed out OR when Supabase isn't configured (demo mode).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  // DEMO MODE — no Supabase env vars: read the dummy session cookie instead.
  if (!isSupabaseConfigured) {
    const cookieStore = await cookies()
    return parseDemoSession(cookieStore.get(DEMO_SESSION_COOKIE)?.value)
  }

  const supabase = await createClient()
  if (!supabase) return null

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, department")
    .eq("id", user.id)
    .single()

  return {
    id: user.id,
    email: user.email ?? "",
    name: profile?.full_name || (user.user_metadata?.full_name as string) || "NITT User",
    role: (profile?.role as UserRole) ?? "student",
    department: profile?.department ?? "",
  }
}
