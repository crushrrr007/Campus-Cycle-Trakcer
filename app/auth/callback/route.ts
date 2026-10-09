import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")
  const requestedNext = searchParams.get("next") ?? "/dashboard"
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") && !requestedNext.includes("\\")
    ? requestedNext
    : "/dashboard"

  if (code) {
    try {
      const supabase = await createClient()
      if (supabase) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) return NextResponse.redirect(new URL(next, origin))
      }
    } catch {
      return NextResponse.redirect(`${origin}/sign-in?error=auth-callback-failed`)
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth-callback-failed`)
}
