"use client"

import { useMemo } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Line,
  LineChart,
  Cell,
} from "recharts"
import {
  DownloadIcon,
  TrendingUpIcon,
  RouteIcon,
  ClockIcon,
  WrenchIcon,
  LayoutDashboardIcon,
  MapPinIcon,
  BikeIcon,
  HeartPulseIcon,
} from "lucide-react"
import { useStore } from "@/lib/store"
import {
  peakHours,
  topStations,
  topBikes,
  averageDuration,
  dailyUsage,
  fleetHealth,
} from "@/lib/analytics"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StationAnalytics } from "@/components/reports/station-analytics"
import { toast } from "sonner"

const peakConfig = { trips: { label: "Trips", color: "var(--chart-1)" } } satisfies ChartConfig
const dailyConfig = { trips: { label: "Trips", color: "var(--chart-2)" } } satisfies ChartConfig

export function ReportsView({
  initialTab,
  initialStationId,
}: {
  initialTab?: string
  initialStationId?: string
}) {
  const { rides, bikes, stations } = useStore()

  const peaks = useMemo(() => peakHours(rides), [rides])
  const daily = useMemo(() => dailyUsage(rides, 14), [rides])
  const stationRanks = useMemo(() => topStations(rides, stations, 8), [rides, stations])
  const bikeRanks = useMemo(() => topBikes(rides, bikes, 8), [rides, bikes])
  const health = useMemo(() => fleetHealth(bikes), [bikes])
  const avgDuration = averageDuration(rides)
  const maintenanceCount = bikes.filter((b) => b.status === "maintenance").length

  const busiestHour = peaks.reduce((max, p) => (p.trips > max.trips ? p : max), peaks[0])

  const defaultTab = ["overview", "stations", "fleet"].includes(initialTab ?? "")
    ? (initialTab as string)
    : "overview"

  function exportSummary() {
    const lines = [
      "CycleNet Campus Mobility Report",
      `Generated,${new Date().toISOString()}`,
      "",
      "Metric,Value",
      `Total rides,${rides.length}`,
      `Average ride duration (min),${avgDuration}`,
      `Busiest hour,${busiestHour?.label ?? "—"}`,
      `Bikes in maintenance,${maintenanceCount}`,
      `Average fleet condition %,${health.avgCondition}`,
      "",
      "Top Stations,Trips,Utilization %",
      ...stationRanks.map((s) => `${s.name},${s.trips},${s.utilization}`),
      "",
      "Top Bikes,Status,Trips",
      ...bikeRanks.map((b) => `${b.bikeId},${b.status},${b.trips}`),
    ]
    const blob = new Blob([lines.join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `cyclenet-report-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Report exported to CSV.")
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Insights generated from {rides.length.toLocaleString()} trips across {stations.length}{" "}
          stations.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            Print
          </Button>
          <Button size="sm" onClick={exportSummary}>
            <DownloadIcon data-icon="inline-start" />
            Export report
          </Button>
        </div>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <LayoutDashboardIcon data-icon="inline-start" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="stations">
            <MapPinIcon data-icon="inline-start" />
            Stations
          </TabsTrigger>
          <TabsTrigger value="fleet">
            <BikeIcon data-icon="inline-start" />
            Fleet
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------ Overview ------------------------------ */}
        <TabsContent value="overview" className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTile label="Total trips" value={rides.length.toLocaleString()} icon={RouteIcon} />
            <KpiTile label="Avg duration" value={`${avgDuration} min`} icon={ClockIcon} />
            <KpiTile label="Busiest hour" value={busiestHour?.label ?? "—"} icon={TrendingUpIcon} />
            <KpiTile label="In maintenance" value={String(maintenanceCount)} icon={WrenchIcon} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Peak usage hours</CardTitle>
                <CardDescription>Trips started by hour of day</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={peakConfig} className="h-64 w-full">
                  <BarChart data={peaks} margin={{ left: -16, right: 8 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={1} />
                    <YAxis tickLine={false} axisLine={false} width={32} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="trips" radius={[4, 4, 0, 0]}>
                      {peaks.map((p) => (
                        <Cell
                          key={p.hour}
                          fill="var(--chart-1)"
                          fillOpacity={p.hour === busiestHour?.hour ? 1 : 0.45}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Daily trips trend</CardTitle>
                <CardDescription>Last 14 days</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={dailyConfig} className="h-64 w-full">
                  <LineChart data={daily} margin={{ left: -16, right: 8 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={2} />
                    <YAxis tickLine={false} axisLine={false} width={32} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      dataKey="trips"
                      type="monotone"
                      stroke="var(--color-trips)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ------------------------------ Stations ------------------------------ */}
        <TabsContent value="stations" className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Station rankings</CardTitle>
              <CardDescription>All stations ranked by trip volume</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Station</TableHead>
                    <TableHead className="text-right">Trips</TableHead>
                    <TableHead className="text-right">Utilization</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stationRanks.map((s) => (
                    <TableRow key={s.name}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.trips}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="tabular-nums">
                          {s.utilization}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">Station deep dive</h2>
            <p className="text-sm text-muted-foreground">
              Pick any station to inspect its flow, peaks, and rider destinations.
            </p>
          </div>
          <StationAnalytics initialStationId={initialStationId} />
        </TabsContent>

        {/* ------------------------------- Fleet -------------------------------- */}
        <TabsContent value="fleet" className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTile label="Fleet size" value={String(bikes.length)} icon={BikeIcon} />
            <KpiTile label="Avg condition" value={`${health.avgCondition}%`} icon={HeartPulseIcon} />
            <KpiTile label="In maintenance" value={String(maintenanceCount)} icon={WrenchIcon} />
            <KpiTile label="Services logged" value={String(health.serviceEvents)} icon={ClockIcon} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Most-used bikes</CardTitle>
                <CardDescription>Highest trip counts in the fleet</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bike</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Trips</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bikeRanks.map((b) => (
                      <TableRow key={b.bikeId}>
                        <TableCell className="font-mono text-sm font-medium">{b.bikeId}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {b.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{b.trips}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Condition breakdown</CardTitle>
                  <CardDescription>Fleet health across {bikes.length} bicycles</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {health.buckets.map((b) => (
                    <div key={b.key} className="flex items-center gap-4">
                      <span className="w-24 shrink-0 text-sm font-medium">{b.label}</span>
                      <Progress
                        value={bikes.length === 0 ? 0 : (b.value / bikes.length) * 100}
                        className="h-2 flex-1"
                      />
                      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                        {b.value}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Needs attention</CardTitle>
                  <CardDescription>Lowest-condition bikes not currently on a ride</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2.5">
                  {health.needsAttention.map((b) => (
                    <div key={b.id} className="flex items-center gap-3">
                      <span className="flex-1 font-mono text-sm">{b.id}</span>
                      <Badge
                        variant={b.condition < 40 ? "destructive" : "secondary"}
                        className="tabular-nums"
                      >
                        {b.condition}%
                      </Badge>
                      <span className="w-24 text-right text-xs capitalize text-muted-foreground">
                        {b.status}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function KpiTile({
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
