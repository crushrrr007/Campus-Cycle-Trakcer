import { PageHeader } from "@/components/page-header"
import { ReportIssueView } from "@/components/report/report-issue-view"

export default function ReportPage() {
  return (
    <>
      <PageHeader
        title="Report an Issue"
        description="Flag a faulty bicycle or station so the transport team can fix it quickly."
      />
      <ReportIssueView />
    </>
  )
}
