import { Badge } from "@/components/ui/badge"
import { bikeFrameLabel, needsStepThroughRestock } from "@/lib/bike-frames"
import type { BikeFrameType } from "@/lib/types"

export function BikeFrameBadge({ frameType }: { frameType: BikeFrameType }) {
  return (
    <Badge variant={frameType === "step-through" ? "secondary" : "outline"} className="max-w-full whitespace-normal text-sm">
      {bikeFrameLabel(frameType)}
    </Badge>
  )
}

export function StationFrameAvailability({
  station,
  admin = false,
}: {
  station: { capacity: number; stepThroughAvailable: number; unclassifiedAvailable: number }
  admin?: boolean
}) {
  const needsRestock = needsStepThroughRestock(station)
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className={station.stepThroughAvailable > 0 ? "font-medium text-primary" : "text-muted-foreground"}>
        {station.stepThroughAvailable} low-frame available
      </span>
      {admin && needsRestock && (
        <span className="font-medium text-destructive">Restock needed · target: at least 1</span>
      )}
      {station.unclassifiedAvailable > 0 && (
        <span className="text-muted-foreground">
          {station.unclassifiedAvailable} available {station.unclassifiedAvailable === 1 ? "bike" : "bikes"} awaiting frame inspection
        </span>
      )}
    </div>
  )
}
