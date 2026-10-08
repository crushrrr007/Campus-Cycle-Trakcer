import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/supabase/session"
import { PageHeader } from "@/components/page-header"
import { StudentDonationView } from "@/components/donations/student-donation-view"

export const metadata: Metadata = {
  title: "Donate a Cycle · CycleNet",
  description: "Give your personally owned bicycle a second life at NIT Trichy. Prepare a donation draft for the campus transport team.",
}

export default async function DonatePage() {
  const user = await getSessionUser()
  if (!user) redirect("/sign-in")
  return (
    <>
      <PageHeader title="Donate a cycle" description="Leaving campus? Let your cycle keep helping the next batch." />
      <StudentDonationView donor={user} />
    </>
  )
}
