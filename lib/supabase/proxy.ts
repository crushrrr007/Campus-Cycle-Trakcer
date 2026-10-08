import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { isNittEmail, isSupabaseConfigured, SUPABASE_URL, SUPABASE_KEY, SUPABASE_COOKIE_OPTIONS } from "./config"

const PUBLIC_PATHS = ["/sign-in", "/sign-up", "/forgot-password", "/auth"]

export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured) {
    const path = request.nextUrl.pathname
    const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`))
    if (!isPublic) {
      const url = request.nextUrl.clone()
      url.pathname = "/sign-in"
      return NextResponse.redirect(url)
    }
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
      cookieOptions: SUPABASE_COOKIE_OPTIONS,
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

  const validUser = Boolean(user?.email_confirmed_at && isNittEmail(user.email ?? ""))
  function redirectWithCookies(pathname: string) {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    url.search = ""
    const response = NextResponse.redirect(url)
    for (const cookie of supabaseResponse.cookies.getAll()) response.cookies.set(cookie)
    return response
  }

  if (!validUser && !isPublic) return redirectWithCookies("/sign-in")
  if (validUser && (path === "/sign-in" || path === "/sign-up")) return redirectWithCookies("/dashboard")

  // You MUST return the supabaseResponse as-is so auth cookies stay in sync.
  return supabaseResponse
}
