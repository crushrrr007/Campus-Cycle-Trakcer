import { PageHeader } from "@/components/page-header"
import { ReportsView } from "@/components/reports/reports-view"

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; station?: string }>
}) {
  const { tab, station } = await searchParams
  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        description="Campus mobility insights, peak-hour analysis, and exportable usage reports."
      />
      <ReportsView initialTab={tab} initialStationId={station} />
    </>
  )
}
