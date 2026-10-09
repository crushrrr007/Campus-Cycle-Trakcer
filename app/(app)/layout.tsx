import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { StoreProvider } from "@/lib/store"
import { getSessionUser } from "@/lib/supabase/session"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Topbar } from "@/components/layout/topbar"
import { AppDataStatus } from "@/components/layout/app-data-status"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default async function AppLayout({ children }: { children: ReactNode }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) redirect("/sign-in")

  return (
    <StoreProvider key={sessionUser.id} sessionUser={sessionUser}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <Topbar />
          <main className="flex flex-1 flex-col gap-6 p-4 pb-24 sm:p-6 md:pb-6"><AppDataStatus />{children}</main>
          <MobileNav />
        </SidebarInset>
      </SidebarProvider>
    </StoreProvider>
  )
}
