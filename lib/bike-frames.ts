import type { Bike, BikeFrameType } from "./types"

export const BIKE_FRAME_OPTIONS: { value: BikeFrameType; label: string }[] = [
  { value: "unclassified", label: "Unclassified — needs inspection" },
  { value: "step-through", label: "Step-through / low-frame" },
  { value: "step-over", label: "Step-over / high-frame" },
]

export function isBikeFrameType(value: unknown): value is BikeFrameType {
  return value === "unclassified" || value === "step-through" || value === "step-over"
}

export function bikeFrameLabel(value: BikeFrameType): string {
  return BIKE_FRAME_OPTIONS.find((option) => option.value === value)?.label ?? BIKE_FRAME_OPTIONS[0].label
}

export function getFrameAvailability(bikes: readonly Pick<Bike, "stationId" | "status" | "frameType">[], stationId: string) {
  const available = bikes.filter((bike) => bike.stationId === stationId && bike.status === "available")
  return {
    stepThroughAvailable: available.filter((bike) => bike.frameType === "step-through").length,
    stepOverAvailable: available.filter((bike) => bike.frameType === "step-over").length,
    unclassifiedAvailable: available.filter((bike) => !isBikeFrameType(bike.frameType) || bike.frameType === "unclassified").length,
  }
}

export function needsStepThroughRestock(station: { capacity: number; stepThroughAvailable: number }) {
  return station.capacity > 0 && station.stepThroughAvailable < 1
}
