"use client"

import { GraduationCap, Shield } from "lucide-react"
import { useRouter } from "next/navigation"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/lib/types"

export function RoleSwitch() {
  const { role, setRole, isDemo } = useStore()
  const router = useRouter()

  // Real signed-in users can't switch roles — only show in demo mode.
  if (!isDemo) return null

  const choose = (r: UserRole) => {
    if (r === role) return
    setRole(r)
    router.push("/dashboard")
  }

  const options: { value: UserRole; label: string; icon: typeof Shield }[] = [
    { value: "student", label: "Student", icon: GraduationCap },
    { value: "admin", label: "Admin", icon: Shield },
  ]

  return (
    <div className="inline-flex items-center rounded-lg border bg-card p-0.5 text-sm">
      {options.map((o) => {
        const Icon = o.icon
        const active = role === o.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => choose(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            <span className="hidden sm:inline">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
