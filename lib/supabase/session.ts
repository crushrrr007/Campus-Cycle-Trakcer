import { createClient } from "./server"
import { isNittEmail, isSupabaseConfigured } from "./config"
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
 * Returns null when signed out or when Supabase isn't configured.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isSupabaseConfigured) return null

  const supabase = await createClient()
  if (!supabase) return null

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email_confirmed_at || !isNittEmail(user.email ?? "")) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, department")
    .eq("id", user.id)
    .single()

  return {
    id: user.id,
    email: user.email ?? "",
    name: profile?.full_name || (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "") || "NITT User",
    role: profile?.role === "admin" ? "admin" : "student",
    department: profile?.department ?? "",
  }
}
