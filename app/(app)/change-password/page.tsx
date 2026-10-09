import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isNittEmail } from "@/lib/supabase/config"
import { PasswordForm } from "@/components/auth/password-form"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Change password | CycleNet",
  description: "Manage your CycleNet password with email verification.",
  robots: { index: false, follow: false },
}

export default async function ChangePasswordPage() {
  const supabase = await createClient()
  const result = supabase ? await supabase.auth.getUser() : null
  const user = result?.data.user
  if (result?.error || !user?.email || !user.email_confirmed_at || !isNittEmail(user.email)) redirect("/sign-in")

  return (
    <>
      <PageHeader title="Account security" description="Keep your campus account secure." />
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Password & email verification</CardTitle>
          <CardDescription>Only your registered college email can authorize a password change.</CardDescription>
        </CardHeader>
        <CardContent><PasswordForm mode="change" accountEmail={user.email} /></CardContent>
      </Card>
    </>
  )
}
