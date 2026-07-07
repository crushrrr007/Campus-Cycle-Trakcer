import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { isSupabaseConfigured, SUPABASE_URL, SUPABASE_KEY } from "./config"
import { DEMO_SESSION_COOKIE, parseDemoSession } from "@/lib/demo-auth"

const PUBLIC_PATHS = ["/sign-in", "/sign-up", "/auth"]

export async function updateSession(request: NextRequest) {
  // DEMO MODE — no Supabase configured. Enforce the same auth flow using
  // the dummy session cookie so login/signup can be tested in the preview.
  if (!isSupabaseConfigured) {
    const demoUser = parseDemoSession(request.cookies.get(DEMO_SESSION_COOKIE)?.value)
    const path = request.nextUrl.pathname
    const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`))

    if (!demoUser && !isPublic) {
      const url = request.nextUrl.clone()
      url.pathname = "/sign-in"
      return NextResponse.redirect(url)
    }
    if (demoUser && (path === "/sign-in" || path === "/sign-up")) {
      const url = request.nextUrl.clone()
      url.pathname = "/dashboard"
      return NextResponse.redirect(url)
    }
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: do not run code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/sign-in"
    return NextResponse.redirect(url)
  }

  if (user && (path === "/sign-in" || path === "/sign-up")) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  // You MUST return the supabaseResponse as-is so auth cookies stay in sync.
  return supabaseResponse
}
