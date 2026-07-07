"use client"

import Link from "next/link"
import {
  BikeIcon,
  ClockIcon,
  LogOutIcon,
  MailIcon,
  MapPinIcon,
  NavigationIcon,
  RouteIcon,
  ShieldIcon,
  WrenchIcon,
} from "lucide-react"
import { useStore } from "@/lib/store"
import { formatDateTime } from "@/lib/analytics"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { StatCard } from "@/components/stat-card"

export function ProfileView() {
  const { currentUser, role, myRides, myIssues, stationName } = useStore()

  const completed = myRides.filter((r) => r.status === "completed")
  const totalMin = completed.reduce((sum, r) => sum + (r.durationMin ?? 0), 0)
  const distanceKm = Math.round((totalMin / 60) * 12)
  const avgMin = completed.length ? Math.round(totalMin / completed.length) : 0
  const longest = completed.reduce((max, r) => Math.max(max, r.durationMin ?? 0), 0)

  // Favorite pickup and drop-off stations.
  const srcFreq = new Map<string, number>()
  const destFreq = new Map<string, number>()
  for (const r of completed) {
    srcFreq.set(r.sourceStationId, (srcFreq.get(r.sourceStationId) ?? 0) + 1)
    if (r.destStationId) destFreq.set(r.destStationId, (destFreq.get(r.destStationId) ?? 0) + 1)
  }
  const topSrc = [...srcFreq.entries()].sort((a, b) => b[1] - a[1])[0]
  const topDest = [...destFreq.entries()].sort((a, b) => b[1] - a[1])[0]

  const openIssues = myIssues.filter((i) => i.status !== "resolved").length
  const lastRide = completed[0]

  const initials = currentUser.name
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="flex flex-col gap-4">
      {/* Identity card */}
      <Card>
        <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarFallback className="bg-primary/15 text-lg font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold">{currentUser.name}</span>
                <Badge variant="secondary" className="capitalize">
                  <ShieldIcon className="size-3" />
                  {role}
                </Badge>
              </div>
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MailIcon className="size-3.5" />
                {currentUser.email}
              </span>
              <span className="text-sm text-muted-foreground">
                {currentUser.department} · Member ID {currentUser.id}
              </span>
            </div>
          </div>
          <Button variant="outline" nativeButton={false} render={<Link href="/sign-in" />}>
            <LogOutIcon data-icon="inline-start" />
            Sign out
          </Button>
        </CardContent>
      </Card>

      {/* Lifetime stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total rides" value={completed.length} icon={RouteIcon} accent="primary" />
        <StatCard label="Time on bike" value={totalMin} unit="min" icon={ClockIcon} accent="muted" />
        <StatCard label="Distance" value={distanceKm} unit="km" icon={NavigationIcon} accent="chart-2" />
        <StatCard label="Avg ride" value={avgMin} unit="min" icon={ClockIcon} accent="primary" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Riding habits */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Riding habits</CardTitle>
            <CardDescription>How you get around campus</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <HabitRow
              icon={ClockIcon}
              label="Average ride"
              value={completed.length ? `${avgMin} min` : "—"}
            />
            <HabitRow icon={BikeIcon} label="Longest ride" value={longest ? `${longest} min` : "—"} />
            <HabitRow
              icon={MapPinIcon}
              label="Favorite pickup"
              value={topSrc ? `${stationName(topSrc[0]).replace(" Station", "")} (${topSrc[1]}x)` : "—"}
            />
            <HabitRow
              icon={NavigationIcon}
              label="Favorite drop-off"
              value={topDest ? `${stationName(topDest[0]).replace(" Station", "")} (${topDest[1]}x)` : "—"}
            />
            <HabitRow
              icon={RouteIcon}
              label="Last ride"
              value={lastRide ? formatDateTime(lastRide.borrowTime) : "—"}
            />
            <Separator />
            <HabitRow
              icon={WrenchIcon}
              label="Open issue reports"
              value={
                openIssues > 0 ? (
                  <Link href="/report" className="font-medium text-primary hover:underline">
                    {openIssues} open
                  </Link>
                ) : (
                  "None"
                )
              }
            />
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
            <CardDescription>Your latest trips around campus</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {myRides.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No rides yet. Scan a bike to get started!
              </p>
            ) : (
              myRides.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                    <BikeIcon className="size-4 text-muted-foreground" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {r.bikeId} · {stationName(r.sourceStationId).replace(" Station", "")}
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
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              nativeButton={false}
              render={<Link href="/rides" />}
            >
              View full ride history
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function HabitRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ClockIcon
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}
