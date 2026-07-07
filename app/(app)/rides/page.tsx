import { PageHeader } from "@/components/page-header"
import { RidesView } from "@/components/rides/rides-view"

export default function RidesPage() {
  return (
    <>
      <PageHeader
        title="Ride History"
        description="Review borrow and return activity with searchable, exportable trip records."
      />
      <RidesView />
    </>
  )
}
