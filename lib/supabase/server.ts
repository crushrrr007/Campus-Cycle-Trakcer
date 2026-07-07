import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { isSupabaseConfigured, SUPABASE_URL, SUPABASE_KEY } from "./config"

/**
 * Server-side Supabase client. Returns null when env vars are missing
 * (demo mode) so callers can gracefully fall back.
 *
 * Don't store this client in a global — always create a new one per request.
 */
export async function createClient() {
  if (!isSupabaseConfigured) return null

  const cookieStore = await cookies()

  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component — safe to ignore when the
            // proxy refreshes sessions.
          }
        },
      },
    },
  )
}
