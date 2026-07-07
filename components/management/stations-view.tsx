"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  MapPinIcon,
  SearchIcon,
  PlusIcon,
  BikeIcon,
  ParkingMeterIcon,
  MoreHorizontalIcon,
} from "lucide-react"
import { useStore, type StationStats } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { StationFormDialog } from "@/components/management/station-form-dialog"
import { StationBikesSheet } from "@/components/management/station-bikes-sheet"
import { toast } from "sonner"

export function StationsView() {
  const router = useRouter()
  const { stations, deleteStation } = useStore()
  const [query, setQuery] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editingStation, setEditingStation] = useState<StationStats | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StationStats | null>(null)
  const [bikesTarget, setBikesTarget] = useState<StationStats | null>(null)

  function openAdd() {
    setEditingStation(null)
    setFormOpen(true)
  }

  function openEdit(station: StationStats) {
    setEditingStation(station)
    setFormOpen(true)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const res = await deleteStation(deleteTarget.id)
    if (res.ok) toast.success(res.message)
    else toast.error(res.message)
    setDeleteTarget(null)
  }

  const rows = useMemo(() => {
    return stations.filter((s) =>
      query ? s.name.toLowerCase().includes(query.toLowerCase()) : true,
    )
  }, [stations, query])

  const totalDocks = stations.reduce((a, s) => a + s.capacity, 0)
  const totalAvailable = rows.reduce((a, r) => a + r.available, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Stations" value={stations.length} icon={MapPinIcon} />
        <Tile label="Total docks" value={totalDocks} icon={ParkingMeterIcon} />
        <Tile label="Bikes available" value={totalAvailable} icon={BikeIcon} />
        <Tile
          label="Avg utilization"
          value={`${Math.round(
            (rows.reduce((a, r) => a + r.utilization, 0) / Math.max(rows.length, 1)),
          )}%`}
          icon={ParkingMeterIcon}
        />
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Docking stations</CardTitle>
            <Button size="sm" onClick={openAdd}>
              <PlusIcon data-icon="inline-start" />
              Add station
            </Button>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search stations…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MapPinIcon />
                </EmptyMedia>
                <EmptyTitle>No stations match your search</EmptyTitle>
                <EmptyDescription>Try a different name or clear the search box.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((station) => (
                <div key={station.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="font-medium">{station.name}</span>
                      <span className="text-xs text-muted-foreground">{station.zone}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant={station.available === 0 ? "destructive" : "secondary"}>
                        {station.available} free
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Actions for ${station.shortName}`}
                            >
                              <MoreHorizontalIcon />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setBikesTarget(station)}>
                            View bicycles
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(`/reports?tab=stations&station=${station.id}`)
                            }
                          >
                            View analytics
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(station)}>Edit</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTarget(station)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Dock utilization</span>
                      <span className="tabular-nums">{station.utilization}%</span>
                    </div>
                    <Progress value={station.utilization} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 border-t pt-3 text-center">
                    <Stat label="Docked" value={station.occupied} />
                    <Stat label="Available" value={station.available} />
                    <Stat label="Capacity" value={station.capacity} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <StationFormDialog open={formOpen} onOpenChange={setFormOpen} station={editingStation} />

      <StationBikesSheet station={bikesTarget} onClose={() => setBikesTarget(null)} />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.occupied > 0
                ? `${deleteTarget.name} still holds ${deleteTarget.occupied} bicycle${deleteTarget.occupied === 1 ? "" : "s"}. Move them to another station before deleting.`
                : "This removes the docking station from the campus map. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-base font-semibold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function Tile({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number | string
  icon: typeof MapPinIcon
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
