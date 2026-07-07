import Image from "next/image"
import { createClient } from "@/lib/supabase/server"

/**
 * Live fleet counts via the anon-callable `public_stats` RPC
 * (see supabase/migrations/005_public_stats.sql). Falls back to
 * static copy if the RPC is unavailable.
 */
async function getFleetStats(): Promise<{ bikes: number; stations: number } | null> {
  try {
    const supabase = await createClient()
    if (!supabase) return null
    const { data, error } = await supabase.rpc("public_stats")
    if (error || !data) return null
    const stats = data as { bikes?: number; stations?: number }
    if (typeof stats.bikes !== "number" || typeof stats.stations !== "number") return null
    return { bikes: stats.bikes, stations: stats.stations }
  } catch {
    return null
  }
}

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const stats = await getFleetStats()
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel — desktop only */}
      <div className="relative hidden overflow-hidden lg:block">
        <Image
          src="/images/nitt-campus.png"
          alt="NIT Tiruchirappalli clock tower and campus"
          fill
          sizes="55vw"
          priority
          className="object-cover"
        />
        {/* Layered scrim for legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/40" />

        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          {/* Institute brand */}
          <div className="flex items-center gap-3.5">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white p-1 shadow-lg ring-1 ring-white/40">
              <Image
                src="/images/nitt-logo.svg"
                alt="NIT Tiruchirappalli emblem"
                width={48}
                height={48}
                className="size-12 object-contain"
              />
            </span>
            <div className="flex flex-col">
              <span className="font-heading text-xl font-bold tracking-tight text-white">
                CycleNet
              </span>
              <span className="text-xs font-medium uppercase tracking-widest text-white/70">
                NIT Tiruchirappalli
              </span>
            </div>
          </div>

          {/* Hero copy */}
          <div className="flex flex-col gap-8">
            <h2 className="max-w-lg text-balance font-heading text-5xl font-bold leading-[1.08] tracking-tight text-white">
              Your campus,
              <br />
              on two wheels.
            </h2>
            <p className="max-w-md text-pretty text-base leading-relaxed text-white/75">
              Scan a QR code, grab a bike, and get anywhere on campus in minutes —
              with live availability across every station.
            </p>

            {/* Stats strip */}
            <div className="flex items-stretch gap-0 overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur-md">
              <Stat value={stats ? String(stats.bikes) : "100+"} label="Bikes on campus" />
              <div className="w-px bg-white/15" aria-hidden="true" />
              <Stat value={stats ? String(stats.stations) : "10"} label="Smart stations" />
              <div className="w-px bg-white/15" aria-hidden="true" />
              <Stat value="24/7" label="Availability" />
            </div>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-col">{children}</div>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-1 flex-col gap-1 px-6 py-5">
      <span className="font-heading text-2xl font-bold tracking-tight text-white">{value}</span>
      <span className="text-xs font-medium text-white/65">{label}</span>
    </div>
  )
}
