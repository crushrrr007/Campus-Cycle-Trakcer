import { cn } from "@/lib/utils"
import type { BikeStatus, StationStatus } from "@/lib/types"

const DOT = "size-1.5 rounded-full"

export function BikeStatusBadge({ status, className }: { status: BikeStatus; className?: string }) {
  const map: Record<BikeStatus, { label: string; dot: string; text: string; bg: string }> = {
    available: { label: "Available", dot: "bg-primary", text: "text-primary", bg: "bg-primary/10" },
    "in-use": { label: "In Use", dot: "bg-chart-2", text: "text-chart-2", bg: "bg-chart-2/10" },
    maintenance: { label: "Maintenance", dot: "bg-warning", text: "text-warning", bg: "bg-warning/10" },
  }
  const s = map[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        s.bg,
        s.text,
        className,
      )}
    >
      <span className={cn(DOT, s.dot)} />
      {s.label}
    </span>
  )
}

export function StationStatusBadge({ status, className }: { status: StationStatus; className?: string }) {
  const map: Record<StationStatus, { label: string; dot: string; text: string; bg: string }> = {
    active: { label: "Healthy", dot: "bg-primary", text: "text-primary", bg: "bg-primary/10" },
    low: { label: "Low stock", dot: "bg-warning", text: "text-warning", bg: "bg-warning/10" },
    full: { label: "Full", dot: "bg-chart-2", text: "text-chart-2", bg: "bg-chart-2/10" },
    offline: { label: "Offline", dot: "bg-muted-foreground", text: "text-muted-foreground", bg: "bg-muted" },
  }
  const s = map[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        s.bg,
        s.text,
        className,
      )}
    >
      <span className={cn(DOT, s.dot)} />
      {s.label}
    </span>
  )
}

// Returns a hex-ish token reference for availability used on the map markers.
export function availabilityLevel(available: number, capacity: number): "green" | "yellow" | "red" {
  if (available === 0) return "red"
  if (capacity > 0 && available / capacity <= 0.25) return "yellow"
  return "green"
}
