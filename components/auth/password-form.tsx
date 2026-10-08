"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Mail } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { isNittEmail, isSupabaseConfigured } from "@/lib/supabase/config"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"

interface PasswordFormProps {
  mode: "reset" | "change"
  accountEmail?: string
}

function preventCompositionSubmit(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
}

function PasswordField({ id, label, value, onChange, disabled, current = false }: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
  current?: boolean
}) {
  const [visible, setVisible] = useState(false)
  return (
    <Field data-disabled={disabled}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup className="h-11">
        <InputGroupInput
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete={current ? "current-password" : "new-password"}
          required
          minLength={current ? undefined : 8}
          maxLength={current ? 1024 : 128}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={preventCompositionSubmit}
          disabled={disabled}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="icon-sm" aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} aria-pressed={visible} disabled={disabled} onClick={() => setVisible((previous) => !previous)}>
            {visible ? <EyeOff /> : <Eye />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </Field>
  )
}

export function PasswordForm({ mode: initialMode, accountEmail }: PasswordFormProps) {
  const [mode, setMode] = useState(initialMode)
  const [step, setStep] = useState<"request" | "update" | "success">("request")
  const [email, setEmail] = useState(accountEmail ?? "")
  const [oldPassword, setOldPassword] = useState("")
  const [token, setToken] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [pending, setPending] = useState<"request" | "update" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [secondsRemaining, setSecondsRemaining] = useState(0)
  const [codeConsumed, setCodeConsumed] = useState(false)
  const [sessionWarning, setSessionWarning] = useState(false)
  const busy = useRef(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (secondsRemaining === 0) return
    const timer = window.setTimeout(() => setSecondsRemaining((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [secondsRemaining])

  useEffect(() => {
    if (step !== "request") headingRef.current?.focus()
  }, [step])

  function clearSecrets() {
    setOldPassword("")
    setToken("")
    setNewPassword("")
    setConfirmPassword("")
  }

  async function submit(action: "request" | "update") {
    if (busy.current || (action === "request" && secondsRemaining > 0)) return
    setError(null)
    setNotice(null)
    if (!isNittEmail(email)) { setError("Enter a valid @nitt.edu college email address."); return }
    if (mode === "change" && !oldPassword) { setError("Enter your current password or choose email recovery."); return }
    if (action === "update") {
      if (!/^\d{8}$/.test(token)) { setError("Enter the complete 8-digit code from your email."); return }
      if (newPassword.length < 8 || newPassword.length > 128) { setError("Use a password between 8 and 128 characters."); return }
      if (newPassword !== confirmPassword) { setError("The new passwords do not match."); return }
      if (mode === "change" && newPassword === oldPassword) { setError("Choose a password different from your current password."); return }
    }
    busy.current = true
    setPending(action)
    try {
      const response = await fetch("/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action, mode, email: email.trim().toLowerCase(), ...(mode === "change" ? { oldPassword } : {}), ...(action === "update" ? { token, newPassword, confirmPassword } : {}) }),
      })
      const result = await response.json() as { error?: string; message?: string; retryAfter?: number; codeConsumed?: boolean; sessionsRevoked?: boolean; success?: boolean }
      if (result.retryAfter) setSecondsRemaining(result.retryAfter)
      if (!response.ok) {
        setError(result.error ?? "Unable to complete this request. Please try again.")
        if (result.codeConsumed) { setToken(""); setCodeConsumed(true) }
        return
      }
      if (action === "request") {
        setEmail(email.trim().toLowerCase())
        setToken("")
        setCodeConsumed(false)
        setNotice(result.message ?? "Check your inbox for the latest recovery code.")
        setStep("update")
      } else if (result.success) {
        clearSecrets()
        setSessionWarning(result.sessionsRevoked === false)
        setStep("success")
        try {
          const { error: signOutError } = await createClient().auth.signOut({ scope: "local" })
          if (signOutError) setSessionWarning(true)
        } catch { setSessionWarning(true) }
      } else {
        setError("The password update could not be confirmed. Please try again.")
      }
    } catch {
      setError("Unable to connect. Check your connection and try again. If you already submitted a code, request a new one before retrying.")
    } finally {
      busy.current = false
      setPending(null)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submit(step === "request" ? "request" : "update")
  }

  function restart(nextMode = mode) {
    clearSecrets()
    setMode(nextMode)
    setStep("request")
    setError(null)
    setNotice(null)
    setCodeConsumed(false)
  }

  if (step === "success") {
    return (
      <section className="flex flex-col gap-6" aria-labelledby="password-heading">
        <CheckCircle2 className="size-10 text-primary" aria-hidden="true" />
        <h2 ref={headingRef} id="password-heading" tabIndex={-1} className="font-heading text-balance text-2xl font-bold text-foreground outline-none">Password updated</h2>
        <p role="status" className="text-sm leading-relaxed text-muted-foreground">Sign in again with your new password.</p>
        {sessionWarning && <Alert><AlertDescription>Your password changed, but we could not confirm that every session was signed out. Use Sign out on any devices still signed in.</AlertDescription></Alert>}
        <Link href="/sign-in" className={buttonVariants({ size: "lg" })}>Back to sign in <ArrowRight data-icon="inline-end" /></Link>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-6" aria-labelledby="password-heading">
      <div className="flex flex-col gap-3">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {step === "update" ? <Mail className="size-6" aria-hidden="true" /> : <KeyRound className="size-6" aria-hidden="true" />}
        </div>
        <h2 ref={headingRef} id="password-heading" tabIndex={-1} className="font-heading text-balance text-2xl font-bold tracking-tight text-foreground outline-none">
          {step === "update" ? "Verify and set your password" : mode === "change" ? "Change your password" : "Reset your password"}
        </h2>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          {step === "update" ? <>Enter the latest 8-digit email code for <span className="break-all font-medium text-foreground">{email}</span> and choose a new password.</> : mode === "change" ? "Confirm your current password, then verify an email code before making the change." : "Forgot your password? Verify a code sent to your college email. No old password is needed."}
        </p>
      </div>
      {!isSupabaseConfigured && <Alert><AlertTitle>Authentication unavailable</AlertTitle><AlertDescription>Password recovery is unavailable until Supabase is configured.</AlertDescription></Alert>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <FieldGroup>
          {step === "request" && (
            <>
              <Field data-disabled={Boolean(pending)}>
                <FieldLabel htmlFor="recovery-email">College email</FieldLabel>
                <Input id="recovery-email" name="email" type="email" autoComplete="email" required maxLength={254} readOnly={Boolean(accountEmail)} value={email} onChange={(event) => setEmail(event.target.value)} onKeyDown={preventCompositionSubmit} disabled={Boolean(pending)} aria-describedby="recovery-email-help" className="h-11" placeholder="you@nitt.edu" />
                <FieldDescription id="recovery-email-help">{accountEmail ? "The code is sent to the email on your signed-in account." : "Use the @nitt.edu address you registered with."}</FieldDescription>
              </Field>
              {mode === "change" && <PasswordField id="old-password" label="Current password" value={oldPassword} onChange={setOldPassword} disabled={Boolean(pending)} current />}
            </>
          )}
          {step === "update" && (
            <>
              <Field data-invalid={codeConsumed} data-disabled={Boolean(pending)}>
                <FieldLabel htmlFor="recovery-otp">8-digit email code</FieldLabel>
                <Input id="recovery-otp" name="token" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" minLength={8} maxLength={8} required value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, "").slice(0, 8))} onKeyDown={preventCompositionSubmit} disabled={Boolean(pending) || codeConsumed} aria-invalid={codeConsumed} aria-describedby="recovery-otp-help" className="h-11" />
                <FieldDescription id="recovery-otp-help">Use the latest code from the password recovery email. Each code can be used once.</FieldDescription>
              </Field>
              <PasswordField id="new-password" label="New password" value={newPassword} onChange={setNewPassword} disabled={Boolean(pending)} />
              <PasswordField id="confirm-password" label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} disabled={Boolean(pending)} />
              <FieldDescription>Use 8–128 characters. A longer, unique password is best. You will need to sign in again after changing it.</FieldDescription>
            </>
          )}
        </FieldGroup>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {notice && <p role="status" className="text-sm leading-relaxed text-muted-foreground">{notice}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={!isSupabaseConfigured || Boolean(pending) || (step === "request" ? secondsRemaining > 0 : codeConsumed || !/^\d{8}$/.test(token))}>
          {pending ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <ArrowRight data-icon="inline-start" />}
          {step === "request" ? (secondsRemaining > 0 ? `Request code in ${secondsRemaining}s` : "Send email code") : "Verify code & update password"}
        </Button>
      </form>
      <div className="flex flex-col gap-2">
        {step === "update" && <Button type="button" variant="outline" disabled={Boolean(pending) || secondsRemaining > 0} onClick={() => void submit("request")}>{secondsRemaining > 0 ? `Resend code in ${secondsRemaining}s` : "Resend code"}</Button>}
        {mode === "change" && <Button type="button" variant="link" disabled={Boolean(pending)} onClick={() => restart("reset")}>Forgot your current password? Use email recovery</Button>}
        {step === "update" ? (
          <Button type="button" variant="ghost" disabled={Boolean(pending)} onClick={() => restart()}><ArrowLeft data-icon="inline-start" />Back</Button>
        ) : (
          <Link href={accountEmail ? "/profile" : "/sign-in"} className={buttonVariants({ variant: "ghost" })}><ArrowLeft data-icon="inline-start" />Back to {accountEmail ? "profile" : "sign in"}</Link>
        )}
      </div>
    </section>
  )
}
