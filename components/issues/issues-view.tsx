"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  SearchIcon,
  SearchCheckIcon,
  WrenchIcon,
} from "lucide-react"
import { useStore } from "@/lib/store"
import type { IssueReport, IssueStatus } from "@/lib/types"
import { formatDateTime, issueCode } from "@/lib/analytics"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

/** NITT student emails are rollnumber@nitt.edu — extract the roll number. */
function rollFromEmail(email: string): string | null {
  const local = email.split("@")[0] ?? ""
  return /^\d{6,}$/.test(local) ? local : null
}

type StatusFilter = "all" | IssueStatus

const CATEGORY_LABELS: Record<string, string> = {
  brakes: "Brakes",
  tyres: "Tyres / wheels",
  chain: "Chain / pedals",
  seat: "Seat / frame",
  dock: "Docking station",
  other: "Other",
}

const STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in-review", label: "In review" },
  { value: "resolved", label: "Resolved" },
]

export function IssuesView() {
  const { issues, updateIssueStatus, stationName } = useStore()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Read from `issues` so the sheet reflects live status changes.
  const selected = selectedId ? (issues.find((i) => i.id === selectedId) ?? null) : null

  const filtered = useMemo(() => {
    return issues
      .filter((i) => (status === "all" ? true : i.status === status))
      .filter((i) => {
        if (!query) return true
        const q = query.toLowerCase()
        return (
          i.id.toLowerCase().includes(q) ||
          i.userName.toLowerCase().includes(q) ||
          i.userEmail.toLowerCase().includes(q) ||
          (i.bikeId?.toLowerCase().includes(q) ?? false) ||
          i.description.toLowerCase().includes(q)
        )
      })
  }, [issues, status, query])

  const openCount = issues.filter((i) => i.status === "open").length
  const reviewCount = issues.filter((i) => i.status === "in-review").length
  const resolvedCount = issues.filter((i) => i.status === "resolved").length

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Open" value={openCount} icon={AlertTriangleIcon} />
        <Tile label="In review" value={reviewCount} icon={SearchCheckIcon} />
        <Tile label="Resolved" value={resolvedCount} icon={CheckCircle2Icon} />
      </div>

      <Card>
        <CardHeader className="gap-4">
          <CardTitle>Reported issues</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:max-w-xs">
              <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search issue, rider, bike…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select
              value={status}
              onValueChange={(v) => v && setStatus(v as StatusFilter)}
              items={[
                { value: "all", label: "All statuses" },
                ...STATUS_OPTIONS,
              ]}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-auto text-sm text-muted-foreground">
              {filtered.length} issue{filtered.length === 1 ? "" : "s"}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <WrenchIcon />
                </EmptyMedia>
                <EmptyTitle>No issues found</EmptyTitle>
                <EmptyDescription>
                  Reports submitted by riders from the Report Issue page will show up here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Issue</TableHead>
                    <TableHead>Reported by</TableHead>
                    <TableHead>Bike / Station</TableHead>
                    <TableHead className="max-w-64">Description</TableHead>
                    <TableHead>Reported</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((issue) => (
                    <IssueRow
                      key={issue.id}
                      issue={issue}
                      stationName={stationName}
                      onOpen={() => setSelectedId(issue.id)}
                      onStatusChange={async (s) => {
                        const res = await updateIssueStatus(issue.id, s)
                        if (res.ok) {
                          toast.success(`${issueCode(issue.id)} marked as ${s.replace("-", " ")}.`)
                        } else {
                          toast.error(res.message)
                        }
                      }}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {issueCode(selected.id)}
                  <StatusBadge status={selected.status} />
                </SheetTitle>
                <SheetDescription>
                  {CATEGORY_LABELS[selected.category] ?? selected.category} · reported{" "}
                  {formatDateTime(selected.createdAt)}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-5 px-4 pb-6">
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-sm font-medium">Reported by</h3>
                  <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {selected.userName
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <span className="text-sm font-medium">{selected.userName}</span>
                      <span className="text-xs text-muted-foreground">
                        {rollFromEmail(selected.userEmail)
                          ? `Roll no. ${rollFromEmail(selected.userEmail)} · ${selected.userEmail}`
                          : selected.userEmail}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1 rounded-lg border bg-card p-3">
                    <span className="text-xs text-muted-foreground">Bicycle</span>
                    <span className="font-mono text-sm font-medium">{selected.bikeId ?? "—"}</span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-lg border bg-card p-3">
                    <span className="text-xs text-muted-foreground">Station</span>
                    <span className="text-sm font-medium">
                      {selected.stationId ? stationName(selected.stationId) : "—"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <h3 className="text-sm font-medium">Description</h3>
                  <p className="rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground">
                    {selected.description}
                  </p>
                </div>

                <Separator />

                <div className="flex flex-col gap-1.5">
                  <h3 className="text-sm font-medium">Update status</h3>
                  <Select
                    value={selected.status}
                    onValueChange={async (v) => {
                      if (v && v !== selected.status) {
                        const res = await updateIssueStatus(selected.id, v as IssueStatus)
                        if (res.ok) {
                          toast.success(`${issueCode(selected.id)} marked as ${v.replace("-", " ")}.`)
                        } else {
                          toast.error(res.message)
                        }
                      }
                    }}
                    items={STATUS_OPTIONS}
                  >
                    <SelectTrigger className="w-full" aria-label={`Change status of ${selected.id}`}>
                      <StatusDot status={selected.status} />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function StatusBadge({ status }: { status: IssueStatus }) {
  const label = STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status
  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      <StatusDot status={status} />
      {label}
    </Badge>
  )
}

function IssueRow({
  issue,
  stationName,
  onOpen,
  onStatusChange,
}: {
  issue: IssueReport
  stationName: (id: string | null) => string
  onOpen: () => void
  onStatusChange: (s: IssueStatus) => void
}) {
  const roll = rollFromEmail(issue.userEmail)
  return (
    <TableRow
      onClick={onOpen}
      className="cursor-pointer"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
      aria-label={`View details of ${issue.id}`}
    >
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">{issueCode(issue.id)}</span>
          <span className="text-xs text-muted-foreground">
            {CATEGORY_LABELS[issue.category] ?? issue.category}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="text-sm">{issue.userName}</span>
          <span className="text-xs text-muted-foreground">
            {roll ? `Roll no. ${roll}` : issue.userEmail}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col text-sm">
          <span className="font-mono">{issue.bikeId ?? "—"}</span>
          <span className="text-xs text-muted-foreground">
            {issue.stationId ? stationName(issue.stationId) : "No station"}
          </span>
        </div>
      </TableCell>
      <TableCell className="max-w-64">
        <p className="truncate text-sm text-muted-foreground" title={issue.description}>
          {issue.description}
        </p>
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDateTime(issue.createdAt)}</TableCell>
      <TableCell
        className="text-right"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Select
          value={issue.status}
          onValueChange={(v) => v && v !== issue.status && onStatusChange(v as IssueStatus)}
          items={STATUS_OPTIONS}
        >
          <SelectTrigger
            size="sm"
            className="ml-auto w-32"
            aria-label={`Change status of ${issue.id}`}
          >
            <StatusDot status={issue.status} />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
    </TableRow>
  )
}

function StatusDot({ status }: { status: IssueStatus }) {
  const color =
    status === "open"
      ? "bg-destructive"
      : status === "in-review"
        ? "bg-chart-2"
        : "bg-primary"
  return <span className={`size-2 shrink-0 rounded-full ${color}`} aria-hidden="true" />
}

function Tile({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: typeof CircleDotIcon
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
