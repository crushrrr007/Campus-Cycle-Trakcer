"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bike, LayoutDashboard, Map, QrCode, Route, UserRound, Wrench } from "lucide-react"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

/**
 * Native-app-style bottom tab bar, shown only on small screens (hidden md+).
 * Role-aware: students get Scan as the prominent center action; admins get
 * their operations shortcuts. Everything else stays reachable via the sidebar.
 */
export function MobileNav() {
  const pathname = usePathname()
  const { role } = useStore()

  if (role === "admin") {
    return (
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 backdrop-blur-lg md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid h-16 grid-cols-5">
          <Tab href="/dashboard" label="Home" icon={LayoutDashboard} active={pathname === "/dashboard"} />
          <Tab href="/map" label="Map" icon={Map} active={pathname === "/map"} />
          <Tab href="/bikes" label="Bikes" icon={Bike} active={pathname === "/bikes"} />
          <Tab href="/rides" label="Rides" icon={Route} active={pathname === "/rides"} />
          <Tab href="/issues" label="Issues" icon={Wrench} active={pathname === "/issues"} />
        </div>
      </nav>
    )
  }

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 backdrop-blur-lg md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid h-16 grid-cols-5">
        <Tab href="/dashboard" label="Home" icon={LayoutDashboard} active={pathname === "/dashboard"} />
        <Tab href="/map" label="Map" icon={Map} active={pathname === "/map"} />

        {/* Prominent center Scan action */}
        <div className="relative flex items-center justify-center">
          <Link
            href="/scan"
            aria-label="Scan and ride"
            aria-current={pathname === "/scan" ? "page" : undefined}
            className={cn(
              "absolute -top-5 flex size-14 items-center justify-center rounded-2xl shadow-lg transition-transform active:scale-95",
              pathname === "/scan"
                ? "bg-primary text-primary-foreground ring-4 ring-primary/25"
                : "bg-primary text-primary-foreground ring-4 ring-background",
            )}
          >
            <QrCode className="size-6" />
          </Link>
          <span className="mt-8 text-[10px] font-medium text-muted-foreground">Scan</span>
        </div>

        <Tab href="/rides" label="Rides" icon={Route} active={pathname === "/rides"} />
        <Tab href="/profile" label="Profile" icon={UserRound} active={pathname === "/profile"} />
      </div>
    </nav>
  )
}

function Tab({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: typeof Map
  active: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center justify-center gap-1 transition-colors active:scale-95",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
          active && "bg-primary/12",
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </Link>
  )
}
