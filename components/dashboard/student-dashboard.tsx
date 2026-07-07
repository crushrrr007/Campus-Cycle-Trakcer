"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  Bike as BikeIcon,
  Clock,
  MapPin,
  Navigation,
  QrCode,
  Route,
  Timer,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StationStatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { useStore } from "@/lib/store"
import { formatDateTime } from "@/lib/analytics"

function useElapsed(iso: string | undefined) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!iso) return
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [iso])
  if (!iso) return 0
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
}

export function StudentDashboard() {
  const { bikes, stations, currentUser, myActiveRide, myRides, stationName } = useStore()

  const elapsed = useElapsed(myActiveRide?.borrowTime)

  const availableNow = bikes.filter((b) => b.status === "available").length
  const completed = myRides.filter((r) => r.status === "completed")
  const totalMin = completed.reduce((sum, r) => sum + (r.durationMin ?? 0), 0)
  const distanceKm = Math.round((totalMin / 60) * 12) // ~12 km/h avg
  const avgMin = completed.length ? Math.round(totalMin / completed.length) : 0

  // Favorite station by borrow frequency.
  const freq = new Map<string, number>()
  for (const r of completed) freq.set(r.sourceStationId, (freq.get(r.sourceStationId) ?? 0) + 1)
  const favId = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const favStation = favId ? stationName(favId).replace(" Station", "") : "—"

  // Best stations to grab a bike right now.
  const grabSpots = [...stations]
    .filter((s) => s.available > 0)
    .sort((a, b) => b.available - a.available)
    .slice(0, 4)

  const recent = myRides.slice(0, 4)

  return (
    <>
      <PageHeader
        title={`Hi, ${currentUser.name.split(" ")[0]}`}
        description="Grab a bike, track your ride, and get around campus faster."
        actions={
          <Button nativeButton={false} render={<Link href="/scan" />}>
            <QrCode data-icon />
            Scan & ride
          </Button>
        }
      />

      {/* Active ride / ready-to-ride hero */}
      {myActiveRide ? (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <BikeIcon className="size-6" />
              </span>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Ride in progress</span>
                  <Badge variant="secondary" className="animate-marker gap-1">
                    <span className="size-1.5 rounded-full bg-primary" />
                    Active
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-mono font-medium text-foreground">{myActiveRide.bikeId}</span>
                  {" · from "}
                  {stationName(myActiveRide.sourceStationId).replace(" Station", "")}
                  {" · "}
                  {elapsed} min elapsed
                </p>
              </div>
            </div>
            <Button variant="outline" nativeButton={false} render={<Link href="/scan" />}>
              <Navigation data-icon />
              Return bike
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <BikeIcon className="size-6" />
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Ready to ride</span>
                <p className="text-sm text-muted-foreground">
                  {availableNow} bikes available across campus right now.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" nativeButton={false} render={<Link href="/map" />}>
                <MapPin data-icon />
                Find a bike
              </Button>
              <Button nativeButton={false} render={<Link href="/scan" />}>
                <QrCode data-icon />
                Scan & ride
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Personal stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Your rides" value={completed.length} icon={Route} accent="primary" />
        <StatCard label="Time on bike" value={totalMin} unit="min" icon={Clock} accent="muted" />
        <StatCard label="Distance covered" value={distanceKm} unit="km" icon={Navigation} accent="chart-2" />
        <StatCard label="Avg ride" value={avgMin} unit="min" icon={Timer} accent="primary" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Where to grab a bike */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base">Where to grab a bike</CardTitle>
              <CardDescription>Stations with the most bikes available now</CardDescription>
            </div>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/map" />}>
              View map
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {grabSpots.length === 0 ? (
              <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
                No bikes available right now — check back shortly.
              </p>
            ) : (
              grabSpots.map((s) => (
                <Link
                  key={s.id}
                  href="/map"
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent/40"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-md bg-muted">
                      <MapPin className="size-4 text-primary" />
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{s.shortName}</span>
                      <span className="text-xs text-muted-foreground">{s.zone}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-lg font-semibold tabular-nums leading-none">{s.available}</span>
                    <StationStatusBadge status={s.status} />
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent rides */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base">Recent rides</CardTitle>
              <CardDescription>Your latest trips</CardDescription>
            </div>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/rides" />}>
              All
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {recent.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No rides yet. Scan a bike to get started!
              </p>
            ) : (
              recent.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <span className="flex size-8 items-center justify-center rounded-md bg-muted">
                    <Route className="size-4 text-muted-foreground" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {stationName(r.sourceStationId).replace(" Station", "")}
                      {" → "}
                      {r.destStationId ? stationName(r.destStationId).replace(" Station", "") : "In progress"}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(r.borrowTime)}</span>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {r.durationMin ? `${r.durationMin} min` : "—"}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Favorite station footnote */}
      <Card className="bg-muted/30">
        <CardContent className="flex items-center gap-3 py-4">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <MapPin className="size-4" />
          </span>
          <p className="text-sm text-muted-foreground">
            Your go-to pickup point is{" "}
            <span className="font-medium text-foreground">{favStation}</span>. See live availability on the{" "}
            <Link href="/map" className="font-medium text-primary hover:underline">
              campus map
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </>
  )
}
