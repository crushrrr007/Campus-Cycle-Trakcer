import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/supabase/session"
import { AuthForm } from "@/components/auth/auth-form"

export const metadata = {
  title: "Sign In — CycleNet NITT",
  description: "Sign in to your CycleNet account",
}

export default async function SignInPage() {
  const user = await getSessionUser()
  if (user) redirect("/dashboard")
  return <AuthForm mode="sign-in" />
}
