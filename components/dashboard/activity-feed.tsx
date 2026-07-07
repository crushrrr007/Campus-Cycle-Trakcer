"use client"

import { ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatTimeAgo } from "@/lib/analytics"
import { useStore } from "@/lib/store"

export function ActivityFeed() {
  const { rides, stationName } = useStore()
  const recent = rides.slice(0, 12)

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-base">Live activity</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-[320px] px-6">
          <div className="flex flex-col pb-4">
            {recent.map((r) => (
              <div key={r.id} className="flex items-center gap-3 border-b py-2.5 last:border-0">
                <span
                  className={
                    "size-2 shrink-0 rounded-full " + (r.status === "active" ? "bg-chart-2" : "bg-primary")
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="font-medium">{r.userName}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="font-mono text-xs text-muted-foreground">{r.bikeId}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="truncate">{stationName(r.sourceStationId).replace(" Station", "")}</span>
                    <ArrowRight className="size-3 shrink-0" />
                    <span className="truncate">
                      {r.destStationId ? stationName(r.destStationId).replace(" Station", "") : "in transit"}
                    </span>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatTimeAgo(r.borrowTime)}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
