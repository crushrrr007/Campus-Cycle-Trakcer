/**
 * Central Supabase configuration.
 *
 * Supports BOTH key formats:
 *  - New publishable key: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (sb_publishable_...)
 *  - Legacy anon key:     NEXT_PUBLIC_SUPABASE_ANON_KEY (eyJ...)
 *
 * When env vars are missing the app falls back to DEMO MODE:
 * in-memory data + dummy cookie-based auth.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""

export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  ""

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY)

export const NITT_DOMAIN = "@nitt.edu"

export function isNittEmail(email: string) {
  return email.toLowerCase().endsWith(NITT_DOMAIN)
}
