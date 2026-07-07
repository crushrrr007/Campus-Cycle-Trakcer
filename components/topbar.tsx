"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut, UserRound, Wrench } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { clearDemoSessionCookie } from "@/lib/demo-auth"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { GlobalSearch } from "@/components/global-search"
import { NotificationsMenu } from "@/components/notifications-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { RoleSwitch } from "@/components/role-switch"
import { useStore } from "@/lib/store"

export function Topbar() {
  const { currentUser, role, isDemo } = useStore()
  const router = useRouter()

  async function handleSignOut() {
    if (isSupabaseConfigured) {
      const supabase = createClient()
      await supabase.auth.signOut()
    } else {
      clearDemoSessionCookie()
    }
    router.push("/sign-in")
    router.refresh()
  }

  const initials = currentUser.name
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-md sm:px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-1 h-6" />
      <div className="hidden flex-1 sm:block">
        <GlobalSearch />
      </div>
      <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2">
        <RoleSwitch />
        <NotificationsMenu />
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button type="button" className="flex items-center gap-2 rounded-lg p-0.5 pl-1 hover:bg-accent/50">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{currentUser.name}</span>
                  <span className="text-xs text-muted-foreground">{currentUser.email}</span>
                  <span className="mt-0.5 w-fit rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium capitalize text-primary">
                    {role}
                  </span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                render={
                  <Link href="/profile">
                    <UserRound />
                    Profile
                  </Link>
                }
              />
              <DropdownMenuItem
                render={
                  <Link href="/report">
                    <Wrench />
                    Report an issue
                  </Link>
                }
              />
            </DropdownMenuGroup>
            {!isDemo && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
