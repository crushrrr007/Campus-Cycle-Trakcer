"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { BrandWordmark } from "@/components/brand"
import { GROUP_ORDER, NAV_ITEMS } from "@/lib/nav"
import { useStore } from "@/lib/store"
import { Badge } from "@/components/ui/badge"

export function AppSidebar() {
  const pathname = usePathname()
  const { role } = useStore()
  const items = NAV_ITEMS.filter((i) => i.roles.includes(role))

  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-4">
        <BrandWordmark />
      </SidebarHeader>
      <SidebarContent>
        {GROUP_ORDER.map((group) => {
          const groupItems = items.filter((i) => i.group === group)
          if (groupItems.length === 0) return null
          return (
            <SidebarGroup key={group}>
              <SidebarGroupLabel>{group}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {groupItems.map((item) => {
                    const active = pathname === item.href
                    const Icon = item.icon
                    return (
                      <SidebarMenuItem key={`${group}-${item.href}`}>
                        <SidebarMenuButton
                          render={<Link href={item.href} />}
                          isActive={active}
                          tooltip={item.title}
                        >
                          <Icon />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>
      <SidebarFooter className="p-3">
        <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-xs">
          <span className="text-muted-foreground">NIT Trichy</span>
          <Badge variant="secondary" className="font-mono">CycleNet</Badge>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
