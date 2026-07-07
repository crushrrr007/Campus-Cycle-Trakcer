import { PageHeader } from "@/components/page-header"
import { StationsView } from "@/components/management/stations-view"

export default function StationsPage() {
  return (
    <>
      <PageHeader
        title="Station Management"
        description="Track dock capacity and bicycle availability across every campus station."
      />
      <StationsView />
    </>
  )
}
