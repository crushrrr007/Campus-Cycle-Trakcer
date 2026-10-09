"use client"

import { RefreshCw, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export function MapAvailabilityStatus({ updatedAt, now, loading, refreshing, uncertain, demo, onRefresh }: {
  updatedAt: number | null
  now: number | null
  loading: boolean
  refreshing: boolean
  uncertain: boolean
  demo: boolean
  onRefresh: () => Promise<void>
}) {
  const elapsed = updatedAt && now ? Math.max(0, Math.floor((now - updatedAt) / 1000)) : 0
  const freshness = updatedAt === null ? "Not yet confirmed" : now === null ? "Checking last update…" : elapsed < 60 ? "Updated just now" : `Last successful update ${Math.floor(elapsed / 60)}m ago`
  return <div className="flex flex-wrap items-center justify-between gap-2">
    <p className="flex items-center gap-2 text-sm leading-relaxed text-muted-foreground" role="status">
      {uncertain && !loading && <WifiOff className="size-4 shrink-0" />}
      {demo ? "Demo availability" : loading ? "Loading availability…" : `${freshness}${uncertain ? " · Availability unconfirmed; refresh before travelling." : ""}`}
    </p>
    <Button variant="ghost" size="sm" disabled={refreshing || loading} onClick={async () => { try { await onRefresh() } catch { toast.error("Unable to refresh availability. Please try again.") } }}><RefreshCw data-icon />{refreshing ? "Refreshing…" : "Refresh"}</Button>
  </div>
}
