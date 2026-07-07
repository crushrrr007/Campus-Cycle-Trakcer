import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/supabase/session"
import { AuthForm } from "@/components/auth/auth-form"

export const metadata = {
  title: "Register — CycleNet NITT",
  description: "Create your CycleNet account with your @nitt.edu email",
}

export default async function SignUpPage() {
  const user = await getSessionUser()
  if (user) redirect("/dashboard")
  return <AuthForm mode="sign-up" />
}
