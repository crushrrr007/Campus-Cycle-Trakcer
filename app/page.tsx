import { redirect } from "next/navigation"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { getSessionUser } from "@/lib/supabase/session"

export default async function Home() {
  // Demo mode (no Supabase env vars): go straight to the app.
  if (!isSupabaseConfigured) redirect("/dashboard")

  const user = await getSessionUser()
  redirect(user ? "/dashboard" : "/sign-in")
}
