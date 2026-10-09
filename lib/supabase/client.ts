import { createBrowserClient } from "@supabase/ssr"
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_COOKIE_OPTIONS } from "./config"

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY, { cookieOptions: SUPABASE_COOKIE_OPTIONS })
}
