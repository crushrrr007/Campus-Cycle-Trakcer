import type { Metadata } from "next"
import { PasswordForm } from "@/components/auth/password-form"

export const metadata: Metadata = {
  title: "Reset password | CycleNet",
  description: "Recover your CycleNet account using an email verification code.",
  robots: { index: false, follow: false },
}

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm"><PasswordForm mode="reset" /></div>
    </main>
  )
}
