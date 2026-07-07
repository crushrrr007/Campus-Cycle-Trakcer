"use client"

import { useState } from "react"
import {
  WrenchIcon,
  CheckCircle2Icon,
  ClockIcon,
  AlertCircleIcon,
  SendIcon,
} from "lucide-react"
import { useStore } from "@/lib/store"
import type { IssueCategory, IssueStatus } from "@/lib/types"
import { formatDateTime, issueCode } from "@/lib/analytics"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { toast } from "sonner"

const CATEGORIES: { value: IssueCategory; label: string }[] = [
  { value: "brakes", label: "Brakes not working" },
  { value: "tyres", label: "Flat or worn tyre" },
  { value: "chain", label: "Chain or gears" },
  { value: "seat", label: "Seat or handlebar" },
  { value: "dock", label: "Docking station problem" },
  { value: "other", label: "Something else" },
]

const NONE = "none"

export function ReportIssueView() {
  const { stations, myActiveRide, myIssues, reportIssue } = useStore()

  const [bikeId, setBikeId] = useState(myActiveRide?.bikeId ?? "")
  const [stationId, setStationId] = useState<string>(NONE)
  const [category, setCategory] = useState<IssueCategory>("brakes")
  const [description, setDescription] = useState("")

  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    setSubmitting(true)
    const res = await reportIssue({
      bikeId: bikeId.trim() || null,
      stationId: stationId === NONE ? null : stationId,
      category,
      description,
    })
    setSubmitting(false)
    if (res.ok) {
      toast.success(res.message)
      setBikeId(myActiveRide?.bikeId ?? "")
      setStationId(NONE)
      setCategory("brakes")
      setDescription("")
    } else {
      toast.error(res.message)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WrenchIcon className="size-5 text-primary" />
            Report a problem
          </CardTitle>
          <CardDescription>
            Spotted a broken bike or a station issue? Tell the transport team and they&apos;ll fix it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="issue-bike">Bicycle code (optional)</Label>
            <Input
              id="issue-bike"
              placeholder="e.g. NITT-0001"
              value={bikeId}
              onChange={(e) => setBikeId(e.target.value.toUpperCase())}
            />
            {myActiveRide && (
              <p className="text-xs text-muted-foreground">
                Pre-filled with your current ride ({myActiveRide.bikeId}).
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Station (optional)</Label>
            <Select
              value={stationId}
              onValueChange={(v) => setStationId(v ?? NONE)}
              items={[
                { value: NONE, label: "Not station related" },
                ...stations.map((s) => ({ value: s.id, label: s.name })),
              ]}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a station" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not station related</SelectItem>
                {stations.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>What&apos;s wrong?</Label>
            <Select
              value={category}
              onValueChange={(v) => v && setCategory(v as IssueCategory)}
              items={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="issue-desc">Describe the problem</Label>
            <Textarea
              id="issue-desc"
              placeholder="e.g. The front brake lever is loose and doesn't stop the bike properly."
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <Button onClick={submit} disabled={!description.trim() || submitting}>
            <SendIcon data-icon="inline-start" />
            {submitting ? "Submitting…" : "Submit report"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your reports</CardTitle>
          <CardDescription>Track the status of issues you&apos;ve submitted.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {myIssues.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <WrenchIcon />
                </EmptyMedia>
                <EmptyTitle>No reports yet</EmptyTitle>
                <EmptyDescription>
                  Issues you report will show up here so you can track their progress.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            myIssues.map((issue) => <IssueRow key={issue.id} issue={issue} />)
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function IssueRow({ issue }: { issue: ReturnType<typeof useStore>["myIssues"][number] }) {
  const { stationName } = useStore()
  const categoryLabel = CATEGORIES.find((c) => c.value === issue.category)?.label ?? issue.category

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="font-mono text-xs text-muted-foreground">{issueCode(issue.id)}</span>
          {categoryLabel}
        </span>
        <IssueStatusBadge status={issue.status} />
      </div>
      <p className="text-sm text-muted-foreground">{issue.description}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {issue.bikeId && <span className="font-mono">{issue.bikeId}</span>}
        {issue.stationId && <span>{stationName(issue.stationId)}</span>}
        <span>{formatDateTime(issue.createdAt)}</span>
      </div>
    </div>
  )
}

function IssueStatusBadge({ status }: { status: IssueStatus }) {
  if (status === "resolved")
    return (
      <Badge variant="secondary" className="gap-1">
        <CheckCircle2Icon className="size-3" />
        Resolved
      </Badge>
    )
  if (status === "in-review")
    return (
      <Badge variant="secondary" className="gap-1">
        <ClockIcon className="size-3" />
        In review
      </Badge>
    )
  return (
    <Badge variant="outline" className="gap-1">
      <AlertCircleIcon className="size-3" />
      Open
    </Badge>
  )
}
