/**
 * Central Supabase configuration.
 *
 * Supports BOTH key formats:
 *  - New publishable key: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (sb_publishable_...)
 *  - Legacy anon key:     NEXT_PUBLIC_SUPABASE_ANON_KEY (eyJ...)
 *
 * Authentication stays disabled until credentials for your own Supabase
 * project are configured. No Marketplace integration is required.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""

export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  ""

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY)

export const SUPABASE_COOKIE_OPTIONS = {
  secure: process.env.NODE_ENV === "production" || Boolean(process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL),
  sameSite: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ? "none" as const : "lax" as const,
}

export const NITT_DOMAIN = "@nitt.edu"

export function isNittEmail(email: string) {
  return /^[^\s@]+@nitt\.edu$/i.test(email.trim())
}
