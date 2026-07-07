import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/supabase/session"
import { isSupabaseConfigured } from "@/lib/supabase/config"

// Server-side role guard for admin-only pages (bikes, stations, issues,
// reports). Students are redirected to their dashboard before any admin UI
// is rendered. In demo mode (no Supabase env vars) the guard is skipped so
// the topbar role switch keeps working.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (isSupabaseConfigured) {
    const user = await getSessionUser()
    if (user?.role !== "admin") redirect("/dashboard")
  }
  return <>{children}</>
}
