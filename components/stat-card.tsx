import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  trend,
  trendLabel,
  accent = "primary",
}: {
  label: string
  value: string | number
  unit?: string
  icon: LucideIcon
  trend?: number
  trendLabel?: string
  accent?: "primary" | "chart-2" | "warning" | "destructive" | "muted"
}) {
  const accentMap: Record<string, string> = {
    primary: "text-primary bg-primary/10",
    "chart-2": "text-chart-2 bg-chart-2/10",
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
    muted: "text-muted-foreground bg-muted",
  }
  const up = (trend ?? 0) >= 0
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          <div className={cn("flex size-8 items-center justify-center rounded-lg", accentMap[accent])}>
            <Icon className="size-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>
        {trend !== undefined && (
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
                up ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive",
              )}
            >
              {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {Math.abs(trend)}%
            </span>
            {trendLabel && <span className="text-muted-foreground">{trendLabel}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
