// Derives a stand's "fill health" from how many cycles are available relative
// to its capacity. Used by the live map pins and the map legend so both stay
// in sync with the same 5 categories shown in the reference design.

export type HealthKey = "empty" | "low" | "balanced" | "filling" | "overflow"

// Fixed, semantic status colors (independent of the light/dark theme) so the
// pins read the same way as the legend: red → amber → green → blue → violet.
export const HEALTH_COLORS: Record<HealthKey, string> = {
  empty: "#e11d48", // red
  low: "#f59e0b", // amber
  balanced: "#16a34a", // green
  filling: "#2563eb", // blue
  overflow: "#7c3aed", // violet
}

export const HEALTH_LABELS: Record<HealthKey, string> = {
  empty: "Empty",
  low: "Low",
  balanced: "Balanced",
  filling: "Filling",
  overflow: "Overflow",
}

export function getStationHealth(available: number, capacity: number): HealthKey {
  if (available <= 0) return "empty"
  const ratio = capacity > 0 ? available / capacity : 0
  if (ratio >= 1) return "overflow"
  if (ratio < 0.35) return "low"
  if (ratio < 0.7) return "balanced"
  return "filling"
}

export function getStationHealthColor(available: number, capacity: number): string {
  return HEALTH_COLORS[getStationHealth(available, capacity)]
}

export const HEALTH_LEGEND: { key: HealthKey; label: string; color: string }[] = (
  ["empty", "low", "balanced", "filling", "overflow"] as HealthKey[]
).map((key) => ({ key, label: HEALTH_LABELS[key], color: HEALTH_COLORS[key] }))
