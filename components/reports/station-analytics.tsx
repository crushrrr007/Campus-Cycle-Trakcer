"use client"

import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  ClockIcon,
  DownloadIcon,
  RouteIcon,
  ScaleIcon,
  TrendingUpIcon,
} from "lucide-react"
import { useStore } from "@/lib/store"
import {
  stationDailyUsage,
  stationPeakHours,
  stationSummary,
  stationTopDestinations,
} from "@/lib/analytics"
import { getStationHealthColor } from "@/lib/station-health"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { toast } from "sonner"

const flowConfig = {
  borrows: { label: "Borrows", color: "var(--chart-2)" },
  returns: { label: "Returns", color: "var(--chart-1)" },
} satisfies ChartConfig

const peakConfig = { trips: { label: "Borrows", color: "var(--chart-1)" } } satisfies ChartConfig

export function StationAnalytics({ initialStationId }: { initialStationId?: string }) {
  const { rides, stations } = useStore()
  const [stationId, setStationId] = useState(
    initialStationId && stations.some((s) => s.id === initialStationId)
      ? initialStationId
      : (stations[0]?.id ?? ""),
  )

  const station = stations.find((s) => s.id === stationId)
  const summary = useMemo(() => stationSummary(rides, stationId), [rides, stationId])
  const daily = useMemo(() => stationDailyUsage(rides, stationId), [rides, stationId])
  const peaks = useMemo(() => stationPeakHours(rides, stationId), [rides, stationId])
  const destinations = useMemo(
    () => stationTopDestinations(rides, stationId, stations),
    [rides, stationId, stations],
  )

  if (!station) return null

  function exportStationCsv() {
    if (!station) return
    const lines = [
      `CycleNet Station Report,${station.name}`,
      `Generated,${new Date().toISOString()}`,
      "",
      "Metric,Value",
      `Total trips,${summary.total}`,
      `Borrows,${summary.borrows}`,
      `Returns,${summary.returns}`,
      `Net flow,${summary.netFlow}`,
      `Avg ride duration (min),${summary.avgDuration}`,
      `Busiest hour,${summary.busiestHour}`,
      `Current availability,${station.available}/${station.capacity}`,
      `Dock utilization %,${station.utilization}`,
      "",
      "Top destinations,Trips,Share %",
      ...destinations.map((d) => `${d.name},${d.trips},${d.share}`),
      "",
      "Date,Borrows,Returns",
      ...daily.map((d) => `${d.date},${d.borrows},${d.returns}`),
    ]
    const blob = new Blob([lines.join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `cyclenet-${station.shortName.toLowerCase().replace(/\s+/g, "-")}-report.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${station.shortName} report exported.`)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Select
            value={stationId}
            onValueChange={(v) => v && setStationId(v)}
            items={stations.map((s) => ({ value: s.id, label: s.name }))}
          >
            <SelectTrigger className="w-56" aria-label="Select station">
              <SelectValue placeholder="Select station" />
            </SelectTrigger>
            <SelectContent>
              {stations.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: getStationHealthColor(station.available, station.capacity) }}
            />
            {station.available}/{station.capacity} available
          </Badge>
        </div>
        <Button size="sm" variant="outline" onClick={exportStationCsv}>
          <DownloadIcon data-icon="inline-start" />
          Export station CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StationKpi label="Total trips" value={summary.total.toLocaleString()} icon={RouteIcon} />
        <StationKpi label="Borrows" value={summary.borrows.toLocaleString()} icon={ArrowUpFromLineIcon} />
        <StationKpi label="Returns" value={summary.returns.toLocaleString()} icon={ArrowDownToLineIcon} />
        <StationKpi label="Avg duration" value={`${summary.avgDuration} min`} icon={ClockIcon} />
        <StationKpi label="Busiest hour" value={summary.busiestHour} icon={TrendingUpIcon} />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 py-4">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ScaleIcon className="size-4.5" />
          </span>
          <div className="flex min-w-40 flex-col">
            <span className="text-sm font-medium">Net flow</span>
            <span className="text-xs text-muted-foreground">
              {summary.netFlow > 0
                ? `Accumulates ${summary.netFlow} bikes — schedule pickups`
                : summary.netFlow < 0
                  ? `Drains ${Math.abs(summary.netFlow)} bikes — schedule refills`
                  : "Balanced borrows and returns"}
            </span>
          </div>
          <div className="flex flex-1 items-center gap-3">
            <Progress value={station.utilization} className="h-2 flex-1" />
            <span className="text-xs tabular-nums text-muted-foreground">
              {station.utilization}% dock utilization
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Borrows vs returns</CardTitle>
            <CardDescription>Daily flow at {station.shortName}, last 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={flowConfig} className="h-64 w-full">
              <BarChart data={daily} margin={{ left: -16, right: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={2} />
                <YAxis tickLine={false} axisLine={false} width={32} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="borrows" fill="var(--color-borrows)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="returns" fill="var(--color-returns)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Peak borrow hours</CardTitle>
            <CardDescription>When riders pick up from {station.shortName}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={peakConfig} className="h-64 w-full">
              <BarChart data={peaks} margin={{ left: -16, right: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={1} />
                <YAxis tickLine={false} axisLine={false} width={32} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="trips" fill="var(--color-trips)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top destinations</CardTitle>
          <CardDescription>Where riders go after borrowing from {station.shortName}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {destinations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No completed trips from this station yet.</p>
          ) : (
            destinations.map((d) => (
              <div key={d.id} className="flex items-center gap-4">
                <span className="w-32 shrink-0 truncate text-sm font-medium">{d.name}</span>
                <Progress value={d.share} className="h-2 flex-1" />
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {d.share}%
                </span>
                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {d.trips} trips
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StationKpi({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof RouteIcon
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4.5" />
        </span>
        <div className="flex flex-col">
          <span className="text-xl font-semibold tabular-nums">{value}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      </CardContent>
    </Card>
  )
}
