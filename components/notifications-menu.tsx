"use client"

import { Bell, BellRing, Bike, CheckCheck, Megaphone, TriangleAlert, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useStore } from "@/lib/store"
import { formatTimeAgo } from "@/lib/analytics"
import type { AppNotification } from "@/lib/types"
import { cn } from "@/lib/utils"

const ICONS = {
  borrow: Bike,
  return: Bike,
  "low-stock": TriangleAlert,
  full: TriangleAlert,
  maintenance: Wrench,
  announcement: Megaphone,
} as const

const TONE: Record<AppNotification["type"], string> = {
  borrow: "text-primary bg-primary/10",
  return: "text-chart-2 bg-chart-2/10",
  "low-stock": "text-warning bg-warning/10",
  full: "text-chart-2 bg-chart-2/10",
  maintenance: "text-warning bg-warning/10",
  announcement: "text-foreground bg-muted",
}

export function NotificationsMenu() {
  const { notifications, unreadCount, markAllRead } = useStore()

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
            {unreadCount > 0 ? <BellRing data-icon /> : <Bell data-icon />}
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex size-2 items-center justify-center">
                <span className="absolute size-2 animate-ping rounded-full bg-primary/70" />
                <span className="size-2 rounded-full bg-primary" />
              </span>
            )}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                {unreadCount} new
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 text-xs">
            <CheckCheck data-icon />
            Mark all read
          </Button>
        </div>
        <Separator />
        <ScrollArea className="h-[360px]">
          <div className="flex flex-col">
            {notifications.map((n) => {
              const Icon = ICONS[n.type]
              return (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50",
                    !n.read && "bg-primary/[0.04]",
                  )}
                >
                  <div className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", TONE[n.type])}>
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium leading-tight">{n.title}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{formatTimeAgo(n.time)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{n.message}</p>
                  </div>
                  {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
