import { PageHeader } from "@/components/page-header"
import { ScanView } from "@/components/scan/scan-view"

export default function ScanPage() {
  return (
    <>
      <PageHeader
        title="Scan & Ride"
        description="Borrow and return campus bicycles with a quick QR scan."
      />
      <ScanView />
    </>
  )
}
