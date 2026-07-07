"use client"

import { useMemo, useState } from "react"
import { SearchIcon, DownloadIcon, RouteIcon, ClockIcon, BikeIcon } from "lucide-react"
import { useStore } from "@/lib/store"
import type { Ride } from "@/lib/types"
import { formatDateTime } from "@/lib/analytics"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { toast } from "sonner"

type StatusFilter = "all" | "active" | "completed"

export function RidesView() {
  const { rides, myRides, role, stationName } = useStore()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [riderFilter, setRiderFilter] = useState<string | null>(null)
  const [showAllRiders, setShowAllRiders] = useState(false)

  const source = role === "admin" ? rides : myRides

  // Per-rider summary for admins: everyone who has ridden, with usage stats.
  const riders = useMemo(() => {
    if (role !== "admin") return []
    const map = new Map<
      string,
      { userId: string; userName: string; rideCount: number; totalMin: number; lastRide: string; active: boolean }
    >()
    for (const r of rides) {
      const entry = map.get(r.userId) ?? {
        userId: r.userId,
        userName: r.userName,
        rideCount: 0,
        totalMin: 0,
        lastRide: r.borrowTime,
        active: false,
      }
      entry.rideCount++
      entry.totalMin += r.durationMin ?? 0
      if (r.borrowTime > entry.lastRide) entry.lastRide = r.borrowTime
      if (r.status === "active") entry.active = true
      map.set(r.userId, entry)
    }
    return [...map.values()].sort((a, b) => b.rideCount - a.rideCount)
  }, [rides, role])

  const filtered = useMemo(() => {
    return source
      .filter((r) => (status === "all" ? true : r.status === status))
      .filter((r) => (riderFilter ? r.userId === riderFilter : true))
      .filter((r) => {
        if (!query) return true
        const q = query.toLowerCase()
        return (
          r.id.toLowerCase().includes(q) ||
          r.bikeId.toLowerCase().includes(q) ||
          r.userName.toLowerCase().includes(q)
        )
      })
  }, [source, status, query, riderFilter])

  const totalDuration = source.reduce((a, r) => a + (r.durationMin ?? 0), 0)
  const avg = source.filter((r) => r.durationMin).length
    ? Math.round(totalDuration / source.filter((r) => r.durationMin).length)
    : 0

  function exportCsv() {
    const header = ["Ride ID", "Bike", "Rider", "From", "To", "Borrowed", "Returned", "Duration (min)", "Status"]
    const lines = filtered.map((r) =>
      [
        r.id,
        r.bikeId,
        r.userName,
        stationName(r.sourceStationId),
        r.destStationId ? stationName(r.destStationId) : "—",
        formatDateTime(r.borrowTime),
        formatDateTime(r.returnTime),
        r.durationMin ?? "",
        r.status,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    )
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `cyclenet-rides-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filtered.length} rides to CSV.`)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Total rides" value={source.length} icon={RouteIcon} />
        <Tile label="Active now" value={source.filter((r) => r.status === "active").length} icon={BikeIcon} />
        <Tile label="Avg duration" value={`${avg} min`} icon={ClockIcon} />
      </div>

      {role === "admin" && riders.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base">Riders</CardTitle>
              <p className="text-sm text-muted-foreground">
                {riders.length} user{riders.length === 1 ? "" : "s"} have taken rides — select one to
                see their full history below.
              </p>
            </div>
            {riderFilter && (
              <Button size="sm" variant="ghost" onClick={() => setRiderFilter(null)}>
                Clear filter
              </Button>
            )}
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(showAllRiders ? riders : riders.slice(0, 8)).map((rider) => (
              <button
                key={rider.userId}
                type="button"
                onClick={() => setRiderFilter(riderFilter === rider.userId ? null : rider.userId)}
                aria-pressed={riderFilter === rider.userId}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/40 ${
                  riderFilter === rider.userId ? "border-primary bg-primary/5" : "bg-card"
                }`}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {rider.userName
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {rider.userName}
                    {rider.active && (
                      <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label="Currently riding" />
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {rider.rideCount} ride{rider.rideCount === 1 ? "" : "s"} · {rider.totalMin} min
                  </span>
                </div>
              </button>
            ))}
            {riders.length > 8 && (
              <Button
                variant="outline"
                className="h-full min-h-14 border-dashed"
                onClick={() => setShowAllRiders((v) => !v)}
              >
                {showAllRiders ? "Show less" : `Show all ${riders.length} riders`}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{role === "admin" ? "All rides" : "My ride history"}</CardTitle>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
              <DownloadIcon data-icon="inline-start" />
              Export CSV
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:max-w-xs">
              <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search ride, bike, rider…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select
              value={status}
              onValueChange={(v) => v && setStatus(v as StatusFilter)}
              items={[
                { value: "all", label: "All rides" },
                { value: "active", label: "Active" },
                { value: "completed", label: "Completed" },
              ]}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All rides</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <span className="ml-auto text-sm text-muted-foreground">{filtered.length} rides</span>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <RouteIcon />
                </EmptyMedia>
                <EmptyTitle>No rides found</EmptyTitle>
                <EmptyDescription>Borrow a bike from the campus map to start your first ride.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              {/* Mobile: card list */}
              <ul className="flex flex-col gap-3 md:hidden">
                {filtered.slice(0, 80).map((ride) => (
                  <RideCard key={ride.id} ride={ride} showRider={role === "admin"} stationName={stationName} />
                ))}
              </ul>

              {/* Desktop: table */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ride</TableHead>
                      {role === "admin" && <TableHead>Rider</TableHead>}
                      <TableHead>Route</TableHead>
                      <TableHead>Borrowed</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.slice(0, 80).map((ride) => (
                      <RideRow key={ride.id} ride={ride} showRider={role === "admin"} stationName={stationName} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function RideCard({
  ride,
  showRider,
  stationName,
}: {
  ride: Ride
  showRider: boolean
  stationName: (id: string | null) => string
}) {
  return (
    <li className="rounded-xl border bg-card p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold">{ride.bikeId}</span>
          {showRider && <span className="truncate text-xs text-muted-foreground">{ride.userName}</span>}
        </div>
        <Badge variant={ride.status === "active" ? "default" : "secondary"} className="shrink-0 capitalize">
          {ride.status}
        </Badge>
      </div>
      <div className="mt-2.5 flex items-center gap-2 text-sm">
        <span className="truncate">{stationName(ride.sourceStationId)}</span>
        <span aria-hidden="true" className="shrink-0 text-muted-foreground">
          {"→"}
        </span>
        {ride.destStationId ? (
          <span className="truncate">{stationName(ride.destStationId)}</span>
        ) : (
          <span className="shrink-0 font-medium text-primary">in transit</span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
        <span>{formatDateTime(ride.borrowTime)}</span>
        <span className="tabular-nums">{ride.durationMin ? `${ride.durationMin} min` : "—"}</span>
      </div>
    </li>
  )
}

function RideRow({
  ride,
  showRider,
  stationName,
}: {
  ride: Ride
  showRider: boolean
  stationName: (id: string | null) => string
}) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">{ride.bikeId}</span>
          <span className="text-xs text-muted-foreground">{ride.id}</span>
        </div>
      </TableCell>
      {showRider && <TableCell className="text-muted-foreground">{ride.userName}</TableCell>}
      <TableCell>
        <span className="text-sm">
          {stationName(ride.sourceStationId)}
          <span className="text-muted-foreground"> → </span>
          {ride.destStationId ? stationName(ride.destStationId) : <span className="text-primary">in transit</span>}
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDateTime(ride.borrowTime)}</TableCell>
      <TableCell className="tabular-nums">{ride.durationMin ? `${ride.durationMin} min` : "—"}</TableCell>
      <TableCell className="text-right">
        <Badge variant={ride.status === "active" ? "default" : "secondary"} className="capitalize">
          {ride.status}
        </Badge>
      </TableCell>
    </TableRow>
  )
}

function Tile({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number | string
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
