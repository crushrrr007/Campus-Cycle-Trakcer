"use client"

import Link from "next/link"
import {
  Bike,
  CircleParking,
  Clock,
  MapPin,
  Route,
  TrendingUp,
  Wrench,
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
import { ActivityFeed } from "@/components/dashboard/activity-feed"
import {
  DistributionChart,
  PeakHoursChart,
  UsageTrendChart,
  WeeklyChart,
} from "@/components/dashboard/charts"
import { StationStatusBadge } from "@/components/status-badge"
import { Progress } from "@/components/ui/progress"
import { useStore } from "@/lib/store"
import {
  averageDuration,
  dailyUsage,
  peakHours,
  statusDistribution,
  topBikes,
  topStations,
  tripsToday,
  weeklyUsage,
} from "@/lib/analytics"

export function AdminDashboard() {
  const { bikes, rides, stations, activeRides, currentUser } = useStore()

  const total = bikes.length
  const available = bikes.filter((b) => b.status === "available").length
  const maintenance = bikes.filter((b) => b.status === "maintenance").length
  const avgDur = averageDuration(rides)
  const today = tripsToday(rides)

  const daily = dailyUsage(rides)
  const weekly = weeklyUsage(rides)
  const peaks = peakHours(rides)
  const dist = statusDistribution(bikes)
  const tStations = topStations(rides, stations)
  const tBikes = topBikes(rides, bikes)

  return (
    <>
      <PageHeader
        title={`Welcome back, ${currentUser.name.split(" ")[1] ?? currentUser.name.split(" ")[0]}`}
        description="Real-time overview of the CycleNet fleet across NIT Trichy campus."
        actions={
          <Button nativeButton={false} render={<Link href="/reports" />}>
            <TrendingUp data-icon />
            View reports
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total bicycles" value={total} icon={Bike} trend={4} trendLabel="vs last week" />
        <StatCard
          label="Available now"
          value={available}
          icon={CircleParking}
          accent="primary"
          trend={2}
          trendLabel="vs yesterday"
        />
        <StatCard label="Active rides" value={activeRides.length} icon={Route} accent="chart-2" trend={9} trendLabel="vs yesterday" />
        <StatCard label="Total stations" value={stations.length} icon={MapPin} accent="muted" />
        <StatCard label="Under maintenance" value={maintenance} icon={Wrench} accent="warning" trend={-3} trendLabel="vs last week" />
        <StatCard label="Avg ride duration" value={avgDur} unit="min" icon={Clock} accent="muted" />
        <StatCard label="Trips today" value={today} icon={TrendingUp} accent="chart-2" trend={12} trendLabel="vs yesterday" />
        <StatCard
          label="Fleet utilization"
          value={`${Math.round(((total - available) / total) * 100)}`}
          unit="%"
          icon={TrendingUp}
          accent="primary"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Daily usage trend</CardTitle>
            <CardDescription>Trips per day over the last 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            <UsageTrendChart data={daily} />
          </CardContent>
        </Card>
        <ActivityFeed />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Peak usage hours</CardTitle>
            <CardDescription>Borrows by hour of day</CardDescription>
          </CardHeader>
          <CardContent>
            <PeakHoursChart data={peaks} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Weekly usage</CardTitle>
            <CardDescription>Trips by day of week</CardDescription>
          </CardHeader>
          <CardContent>
            <WeeklyChart data={weekly} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bicycle status</CardTitle>
            <CardDescription>Distribution across the fleet</CardDescription>
          </CardHeader>
          <CardContent>
            <DistributionChart data={dist} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Station utilization</CardTitle>
            <CardDescription>Most active stations by trips</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {tStations.map((s) => (
              <div key={s.name} className="flex items-center gap-4">
                <span className="w-28 shrink-0 truncate text-sm font-medium">{s.name}</span>
                <Progress value={s.utilization} className="h-2 flex-1" />
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {s.utilization}%
                </span>
                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {s.trips} trips
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Most used bicycles</CardTitle>
            <CardDescription>By total trips</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {tBikes.map((b, i) => (
              <div key={b.bikeId} className="flex items-center gap-3">
                <span className="flex size-6 items-center justify-center rounded-md bg-muted text-xs font-medium tabular-nums">
                  {i + 1}
                </span>
                <span className="flex-1 font-mono text-sm">{b.bikeId}</span>
                <span className="text-sm font-medium tabular-nums">{b.trips}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stations at a glance</CardTitle>
          <CardDescription>Live availability across campus — click a station for its analytics</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {stations.map((s) => (
            <Link
              key={s.id}
              href={`/reports?tab=stations&station=${s.id}`}
              className="flex flex-col gap-2 rounded-lg border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent/40"
            >
              <div className="flex items-center justify-between">
                <span className="truncate text-sm font-medium">{s.shortName}</span>
                <StationStatusBadge status={s.status} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-semibold tabular-nums">{s.available}</span>
                <span className="text-sm text-muted-foreground">/ {s.capacity} bikes</span>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </>
  )
}
