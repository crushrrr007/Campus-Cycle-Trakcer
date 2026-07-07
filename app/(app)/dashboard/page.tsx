"use client"

import { AdminDashboard } from "@/components/dashboard/admin-dashboard"
import { StudentDashboard } from "@/components/dashboard/student-dashboard"
import { useStore } from "@/lib/store"

export default function DashboardPage() {
  const { role } = useStore()
  return role === "admin" ? <AdminDashboard /> : <StudentDashboard />
}
