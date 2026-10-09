"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { ArrowLeft, ArrowRight, Loader2, Mail } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { authErrorMessage } from "@/lib/supabase/auth-errors"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

interface EmailOtpVerificationProps {
  email: string
  codeSent: boolean
  onVerified: () => void
  onBack: () => void
}

export function EmailOtpVerification({ email, codeSent, onVerified, onBack }: EmailOtpVerificationProps) {
  const [token, setToken] = useState("")
  const [pending, setPending] = useState<"verify" | "resend" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [secondsRemaining, setSecondsRemaining] = useState(codeSent ? 60 : 0)
  const busy = useRef(false)

  useEffect(() => {
    if (secondsRemaining === 0) return
    const timer = window.setTimeout(() => setSecondsRemaining((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [secondsRemaining])

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current) return
    if (!/^\d{8}$/.test(token)) {
      setError("Enter the complete 8-digit code from your email.")
      return
    }
    busy.current = true
    setPending("verify")
    setError(null)
    setNotice(null)
    try {
      const { data, error: verificationError } = await createClient().auth.verifyOtp({
        email,
        token,
        type: "email",
      })
      if (verificationError) {
        setError(authErrorMessage(verificationError, "verify"))
        return
      }
      if (!data.session || !data.user?.email_confirmed_at) {
        setError("Verification did not complete. Please try again.")
        return
      }
      onVerified()
    } catch {
      setError("Unable to connect. Please check your connection and try again.")
    } finally {
      busy.current = false
      setPending(null)
    }
  }

  async function resendCode() {
    if (busy.current || secondsRemaining > 0) return
    busy.current = true
    setPending("resend")
    setError(null)
    setNotice(null)
    try {
      const { error: resendError } = await createClient().auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`,
        },
      })
      if (resendError) {
        if (resendError.status === 429) setSecondsRemaining(60)
        setError(authErrorMessage(resendError, "resend"))
        return
      }
      setToken("")
      setSecondsRemaining(60)
      setNotice("A new code has been requested. Check your inbox and spam folder.")
    } catch {
      setError("Unable to connect. Please check your connection and try again.")
    } finally {
      busy.current = false
      setPending(null)
    }
  }

  return (
    <section className="flex w-full flex-col gap-6" aria-labelledby="verification-heading">
      <div className="flex flex-col gap-3">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Mail className="size-6" aria-hidden="true" />
        </div>
        <h2 id="verification-heading" className="font-heading text-balance text-2xl font-bold tracking-tight text-foreground">
          Verify your college email
        </h2>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          {codeSent ? "Enter the 8-digit verification code sent to " : "Enter the 8-digit code for "}
          <span className="break-all font-medium text-foreground">{email}</span>.
          {!codeSent && " Need a fresh code? Request one below."}
        </p>
      </div>
      <form onSubmit={verifyCode} className="flex flex-col gap-5">
        <FieldGroup>
          <Field data-invalid={Boolean(error)} data-disabled={Boolean(pending)}>
            <FieldLabel htmlFor="email-otp">8-digit verification code</FieldLabel>
            <Input
              id="email-otp"
              name="token"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{8}"
              minLength={8}
              maxLength={8}
              required
              autoFocus
              value={token}
              onChange={(event) => {
                setToken(event.target.value.replace(/\D/g, "").slice(0, 8))
                setError(null)
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
              }}
              disabled={Boolean(pending)}
              aria-invalid={Boolean(error)}
              aria-describedby="otp-help"
            />
            <FieldDescription id="otp-help">Use the latest code. Leading zeros are part of the code.</FieldDescription>
          </Field>
        </FieldGroup>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {notice && <p role="status" className="text-sm leading-relaxed text-muted-foreground">{notice}</p>}
        <Button type="submit" size="lg" disabled={Boolean(pending) || !/^\d{8}$/.test(token)} className="w-full">
          {pending === "verify" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <ArrowRight data-icon="inline-start" />}
          Verify email
        </Button>
      </form>
      <div className="flex flex-col gap-2">
        <Button type="button" variant="outline" disabled={Boolean(pending) || secondsRemaining > 0} onClick={resendCode}>
          {pending === "resend" && <Loader2 data-icon="inline-start" className="animate-spin" />}
          {secondsRemaining > 0 ? `Resend code in ${secondsRemaining}s` : "Resend code"}
        </Button>
        <Button type="button" variant="ghost" disabled={Boolean(pending)} onClick={onBack}>
          <ArrowLeft data-icon="inline-start" />
          Back to {codeSent ? "registration" : "sign in"}
        </Button>
      </div>
    </section>
  )
}
