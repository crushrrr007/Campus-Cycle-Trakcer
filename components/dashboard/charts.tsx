"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const usageConfig = {
  trips: { label: "Trips", color: "var(--chart-1)" },
} satisfies ChartConfig

export function UsageTrendChart({ data }: { data: { label: string; trips: number }[] }) {
  return (
    <ChartContainer config={usageConfig} className="h-[260px] w-full">
      <AreaChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
        <defs>
          <linearGradient id="fillTrips" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-trips)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-trips)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
        <YAxis tickLine={false} axisLine={false} width={28} fontSize={11} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          dataKey="trips"
          type="monotone"
          stroke="var(--color-trips)"
          strokeWidth={2}
          fill="url(#fillTrips)"
        />
      </AreaChart>
    </ChartContainer>
  )
}

const peakConfig = {
  trips: { label: "Trips", color: "var(--chart-2)" },
} satisfies ChartConfig

export function PeakHoursChart({ data }: { data: { label: string; trips: number }[] }) {
  return (
    <ChartContainer config={peakConfig} className="h-[240px] w-full">
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={10} interval={1} />
        <YAxis tickLine={false} axisLine={false} width={28} fontSize={11} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="trips" fill="var(--color-trips)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}

const weeklyConfig = {
  trips: { label: "Trips", color: "var(--chart-1)" },
} satisfies ChartConfig

export function WeeklyChart({ data }: { data: { label: string; trips: number }[] }) {
  return (
    <ChartContainer config={weeklyConfig} className="h-[240px] w-full">
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
        <YAxis tickLine={false} axisLine={false} width={28} fontSize={11} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="trips" fill="var(--color-trips)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}

const distConfig = {
  value: { label: "Bicycles" },
  available: { label: "Available", color: "var(--chart-1)" },
  "in-use": { label: "In Use", color: "var(--chart-2)" },
  maintenance: { label: "Maintenance", color: "var(--chart-3)" },
} satisfies ChartConfig

export function DistributionChart({
  data,
}: {
  data: { key: string; label: string; value: number }[]
}) {
  const colors: Record<string, string> = {
    available: "var(--chart-1)",
    "in-use": "var(--chart-2)",
    maintenance: "var(--chart-3)",
  }
  return (
    <ChartContainer config={distConfig} className="mx-auto aspect-square max-h-[240px]">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
        <Pie data={data} dataKey="value" nameKey="label" innerRadius={56} strokeWidth={3} paddingAngle={2}>
          {data.map((d) => (
            <Cell key={d.key} fill={colors[d.key]} />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="label" />} className="flex-wrap gap-2" />
      </PieChart>
    </ChartContainer>
  )
}
