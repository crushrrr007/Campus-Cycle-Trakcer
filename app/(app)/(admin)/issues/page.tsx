import { PageHeader } from "@/components/page-header"
import { IssuesView } from "@/components/issues/issues-view"

export default function IssuesPage() {
  return (
    <>
      <PageHeader
        title="Reported Issues"
        description="Track and resolve problems reported by riders across the fleet."
      />
      <IssuesView />
    </>
  )
}
