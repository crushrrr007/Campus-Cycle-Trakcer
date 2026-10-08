import type { Metadata } from "next"
import { PageHeader } from "@/components/page-header"
import { AdminDonationsView } from "@/components/donations/admin-donations-view"

export const metadata: Metadata = {
  title: "Donation Review · CycleNet",
  description: "Review submitted student bicycle donations, verify ownership, and save assessments for fleet use, repairs, or spare parts at NIT Trichy.",
}

export default function DonationsPage() {
  return (
    <>
      <PageHeader title="Cycle donations" description="Review what students leave behind, and find the best way to put it to use." />
      <AdminDonationsView />
    </>
  )
}
