import { PageHeader } from "@/components/page-header"
import { BikesView } from "@/components/management/bikes-view"

export default function BikesPage() {
  return (
    <>
      <PageHeader
        title="Bicycle Management"
        description="Monitor and manage every bicycle across the NIT Trichy campus fleet."
      />
      <BikesView />
    </>
  )
}
