import type { ReactNode } from "react"
import { StoreProvider } from "@/lib/store"
import { getSessionUser } from "@/lib/supabase/session"
import { AppSidebar } from "@/components/app-sidebar"
import { MobileNav } from "@/components/mobile-nav"
import { Topbar } from "@/components/topbar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

// When Supabase env vars are set, the proxy enforces auth and the real
// session user (with their role) is passed to the store. Without env vars
// the app runs in demo mode with the role switch in the topbar.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const sessionUser = await getSessionUser()

  return (
    <StoreProvider sessionUser={sessionUser}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <Topbar />
          <main className="flex flex-1 flex-col gap-6 p-4 pb-24 sm:p-6 md:pb-6">{children}</main>
          <MobileNav />
        </SidebarInset>
      </SidebarProvider>
    </StoreProvider>
  )
}
