"use client"

import { useMemo, useState } from "react"
import {
  BikeIcon,
  SearchIcon,
  MapPinIcon,
  WrenchIcon,
  PlusIcon,
  MoreHorizontalIcon,
  HeartPulseIcon,
} from "lucide-react"
import { useStore } from "@/lib/store"
import type { Bike, BikeStatus } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BikeStatusBadge } from "@/components/status-badge"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { BikeFormDialog } from "@/components/management/bike-form-dialog"
import { BikeDetailSheet } from "@/components/management/bike-detail-sheet"
import { toast } from "sonner"

const STATUS_OPTIONS: { value: BikeStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "available", label: "Available" },
  { value: "in-use", label: "In use" },
  { value: "maintenance", label: "Maintenance" },
]

export function BikesView() {
  const { bikes, stationName, toggleMaintenance, deleteBike } = useStore()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<BikeStatus | "all">("all")
  const [formOpen, setFormOpen] = useState(false)
  const [editingBike, setEditingBike] = useState<Bike | null>(null)
  const [detailBikeId, setDetailBikeId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Bike | null>(null)

  function openRegister() {
    setEditingBike(null)
    setFormOpen(true)
  }

  function openEdit(bike: Bike) {
    setEditingBike(bike)
    setFormOpen(true)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const res = await deleteBike(deleteTarget.id)
    if (res.ok) {
      toast.success(res.message)
      if (detailBikeId === deleteTarget.id) setDetailBikeId(null)
    } else {
      toast.error(res.message)
    }
    setDeleteTarget(null)
  }

  const filtered = useMemo(() => {
    return bikes.filter((b) => {
      if (status !== "all" && b.status !== status) return false
      if (query) {
        const q = query.toLowerCase()
        return (
          b.id.toLowerCase().includes(q) ||
          b.model.toLowerCase().includes(q) ||
          stationName(b.stationId).toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [bikes, status, query, stationName])

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile label="Total fleet" value={bikes.length} icon={BikeIcon} />
        <SummaryTile
          label="Available"
          value={bikes.filter((b) => b.status === "available").length}
          icon={MapPinIcon}
        />
        <SummaryTile
          label="In use"
          value={bikes.filter((b) => b.status === "in-use").length}
          icon={BikeIcon}
        />
        <SummaryTile
          label="In maintenance"
          value={bikes.filter((b) => b.status === "maintenance").length}
          icon={WrenchIcon}
        />
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Bicycle fleet</CardTitle>
            <Button size="sm" onClick={openRegister}>
              <PlusIcon data-icon="inline-start" />
              Register bike
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:max-w-xs">
              <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by ID, model, station…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as BikeStatus | "all")}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-auto text-sm text-muted-foreground">
              {filtered.length} of {bikes.length}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BikeIcon />
                </EmptyMedia>
                <EmptyTitle>No bikes match your filters</EmptyTitle>
                <EmptyDescription>Try clearing the search or selecting a different status.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bike</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead className="text-right">Rides</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 60).map((bike) => (
                    <BikeRow
                      key={bike.id}
                      bike={bike}
                      location={stationName(bike.stationId)}
                      onOpenDetail={() => setDetailBikeId(bike.id)}
                      onEdit={() => openEdit(bike)}
                      onDelete={() => setDeleteTarget(bike)}
                      onToggleMaintenance={() => {
                        toggleMaintenance(bike.id)
                        toast.success(`${bike.id} maintenance status updated.`)
                      }}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <BikeFormDialog open={formOpen} onOpenChange={setFormOpen} bike={editingBike} />

      <BikeDetailSheet
        bikeId={detailBikeId}
        onClose={() => setDetailBikeId(null)}
        onEdit={(id) => {
          const b = bikes.find((x) => x.id === id)
          if (b) openEdit(b)
        }}
      />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the bicycle and its service history from the fleet. This
              action cannot be undone.
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

function ConditionBadge({ condition }: { condition: number }) {
  const variant = condition >= 80 ? "secondary" : condition >= 60 ? "outline" : "destructive"
  return (
    <span className="flex items-center gap-1.5">
      <HeartPulseIcon
        className={condition >= 60 ? "size-4 text-primary" : "size-4 text-destructive"}
      />
      <Badge variant={variant} className="tabular-nums">
        {condition}%
      </Badge>
    </span>
  )
}

function BikeRow({
  bike,
  location,
  onOpenDetail,
  onEdit,
  onDelete,
  onToggleMaintenance,
}: {
  bike: Bike
  location: string
  onOpenDetail: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleMaintenance: () => void
}) {
  return (
    <TableRow className="cursor-pointer" onClick={onOpenDetail}>
      <TableCell>
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <BikeIcon className="size-4" />
          </span>
          <div className="flex flex-col">
            <span className="font-medium">{bike.id}</span>
            <span className="text-xs text-muted-foreground">{bike.model}</span>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <BikeStatusBadge status={bike.status} />
      </TableCell>
      <TableCell className="text-muted-foreground">
        {bike.status === "in-use" ? "In transit" : location}
      </TableCell>
      <TableCell>
        <ConditionBadge condition={bike.condition} />
      </TableCell>
      <TableCell className="text-right tabular-nums">{bike.usageCount}</TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Bike actions">
                <MoreHorizontalIcon />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{bike.id}</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={onOpenDetail}>View details</DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleMaintenance} disabled={bike.status === "in-use"}>
                {bike.status === "maintenance" ? "Return to service" : "Send to maintenance"}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete} disabled={bike.status === "in-use"}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

function SummaryTile({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: typeof BikeIcon
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
