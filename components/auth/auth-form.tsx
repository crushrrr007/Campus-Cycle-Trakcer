"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Bike, Eye, EyeOff, Info, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { isNittEmail, isSupabaseConfigured, NITT_DOMAIN } from "@/lib/supabase/config"
import { demoSignIn, demoSignUp, setDemoSessionCookie } from "@/lib/demo-auth"
import { cn } from "@/lib/utils"

interface AuthFormProps {
  mode: "sign-in" | "sign-up"
}

const TEST_ACCOUNTS = [
  { label: "Student", email: "106122045@nitt.edu", password: "Student@1234" },
  { label: "Admin", email: "admin@nitt.edu", password: "Admin@1234" },
]

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signUpDone, setSignUpDone] = useState(false)

  const isSignUp = mode === "sign-up"

  // Validate @nitt.edu on every keystroke so the user sees feedback early
  const emailValid = email === "" || isNittEmail(email)
  const emailError =
    email !== "" && !isNittEmail(email)
      ? "Only @nitt.edu college email addresses are allowed"
      : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Hard guard — prevent submit even if JS validation was bypassed
    if (!isNittEmail(email)) {
      setError("Access is restricted to @nitt.edu email addresses.")
      return
    }

    // DEMO MODE — no Supabase env vars: use the dummy in-preview auth.
    if (!isSupabaseConfigured) {
      setLoading(true)
      if (isSignUp) {
        setDemoSessionCookie(demoSignUp(name, email))
      } else {
        const { session, error: err } = demoSignIn(email, password)
        if (!session) {
          setError(err)
          setLoading(false)
          return
        }
        setDemoSessionCookie(session)
      }
      router.push("/dashboard")
      router.refresh()
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      if (isSignUp) {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo:
              process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
              `${window.location.origin}/auth/callback`,
            data: {
              full_name: name,
            },
          },
        })
        if (err) {
          setError(err.message)
          return
        }
        setSignUpDone(true)
        return
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) {
          setError(err.message === "Invalid login credentials" ? "Invalid email or password" : err.message)
          return
        }
      }
      router.push("/dashboard")
      router.refresh()
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (signUpDone) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <Bike className="size-7 text-primary" />
          </div>
          <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Check your inbox
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">{email}</span>. Confirm your college
            email to activate your CycleNet account.
          </p>
          <Link
            href="/sign-in"
            className="mt-6 inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Back to sign in
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-background px-5 py-10">
      {/* Subtle ambient glow behind the form */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative w-full max-w-sm">
        {/* Brand — hidden on lg where the split panel carries branding */}
        <div className="mb-10 flex flex-col items-center gap-3.5 lg:hidden">
          <div className="flex size-16 items-center justify-center rounded-full bg-card p-1 shadow-md ring-1 ring-border">
            <Image
              src="/images/nitt-logo.svg"
              alt="NIT Tiruchirappalli emblem"
              width={56}
              height={56}
              className="size-14 object-contain"
            />
          </div>
          <div className="text-center">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
              CycleNet
            </h1>
            <p className="mt-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              NIT Tiruchirappalli
            </p>
          </div>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-6 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>
              <span className="font-medium text-foreground">Demo mode.</span> Supabase is not connected,
              so dummy auth is active — {isSignUp ? (
                <>sign up with any <span className="font-mono">@nitt.edu</span> email</>
              ) : (
                <>use the test credentials below</>
              )}. Real auth activates once you set the env vars (see{" "}
              <span className="font-mono">supabase/README.md</span>).
            </span>
          </div>
        )}

        {/* Heading */}
        <div className="mb-7">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            {isSignUp ? "Create your account" : "Welcome back"}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {isSignUp
              ? "Use your NIT Trichy college email to register."
              : "Sign in to continue to CycleNet."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {isSignUp && (
            <div className="flex flex-col gap-2">
              <label htmlFor="name" className="text-sm font-medium text-foreground">
                Full name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                placeholder="Aarav Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 w-full rounded-xl border border-input bg-muted/40 px-3.5 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/50 focus:bg-background focus:ring-4 focus:ring-primary/10 disabled:opacity-50"
                disabled={loading}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              {isSignUp ? "College email" : "Email"}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder={isSignUp ? "rollno@nitt.edu" : "you@nitt.edu"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={cn(
                "h-11 w-full rounded-xl border border-input bg-muted/40 px-3.5 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/50 focus:bg-background focus:ring-4 focus:ring-primary/10 disabled:opacity-50",
                !emailValid && "border-destructive/60 focus:border-destructive focus:ring-destructive/10",
              )}
              disabled={loading}
            />
            {emailError ? (
              <p className="text-xs text-destructive">{emailError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Must end with <span className="font-medium text-foreground">{NITT_DOMAIN}</span>
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                required
                minLength={8}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-xl border border-input bg-muted/40 px-3.5 pr-11 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/50 focus:bg-background focus:ring-4 focus:ring-primary/10 disabled:opacity-50"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition hover:text-foreground"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {isSignUp && <p className="text-xs text-muted-foreground">At least 8 characters</p>}
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (email !== "" && !isNittEmail(email))}
            className="group mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                {isSignUp ? "Create account" : "Sign in"}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </form>

        {/* One-tap test accounts (sign-in only) */}
        {!isSignUp && (
          <div className="mt-6">
            <div className="flex items-center gap-3" aria-hidden="true">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                Quick sign in
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="mt-3.5 grid grid-cols-2 gap-2.5">
              {TEST_ACCOUNTS.map((acct) => (
                <button
                  key={acct.email}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setEmail(acct.email)
                    setPassword(acct.password)
                    setError(null)
                  }}
                  className="flex flex-col items-start gap-0.5 rounded-xl border border-dashed bg-muted/30 px-3.5 py-3 text-left transition hover:border-primary/40 hover:bg-accent active:scale-[0.98] disabled:opacity-50"
                >
                  <span className="text-sm font-semibold text-foreground">{acct.label}</span>
                  <span className="w-full truncate font-mono text-[11px] text-muted-foreground">
                    {acct.email}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Tap an account to autofill, then press Sign in
            </p>
          </div>
        )}

        {/* Footer */}
        <p className="mt-8 text-center text-sm text-muted-foreground">
          {isSignUp ? (
            <>
              Already have an account?{" "}
              <Link
                href="/sign-in"
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </>
          ) : (
            <>
              Don&apos;t have an account?{" "}
              <Link
                href="/sign-up"
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                Register
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
