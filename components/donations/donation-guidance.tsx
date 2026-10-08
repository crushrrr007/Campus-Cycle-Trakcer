import { BikeIcon, InfoIcon, PackageIcon, WrenchIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export function DonationDraftNotice({ admin = false }: { admin?: boolean }) {
  return (
    <Alert>
      <InfoIcon />
      <AlertTitle>Online donations enabled</AlertTitle>
      <AlertDescription>
        {admin
          ? "Open a submitted request to verify ownership and save your assessment. Students can see saved outcomes in their account. Imported backup files remain offline; neither a review nor a download registers a cycle in the fleet."
          : "Attach ownership proof and submit your request to the transport team. Your request and document are accessible only to you and campus admins. Downloading a backup alone does not submit a request."}
      </AlertDescription>
    </Alert>
  )
}

export function DonationGuidance() {
  const pathways = [
    { icon: BikeIcon, title: "A second life on campus", description: "A working cycle can join the shared fleet after handover and a safety check." },
    { icon: WrenchIcon, title: "Repair and return to service", description: "A cycle needing a little care can be repaired, inspected, and put back on the road." },
    { icon: PackageIcon, title: "Keep other cycles rolling", description: "Even a non-rideable cycle may provide useful wheels, seats, gears, and other parts." },
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle>Leave a cycle. Keep a campus moving.</CardTitle>
        <CardDescription>Especially for graduating students — open to anyone with a personally owned cycle to donate.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Badge variant="secondary" className="w-fit">Final-year students welcome</Badge>
        <div className="flex flex-col gap-5">
          {pathways.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex items-start gap-3">
              <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-medium">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
        </div>
        <Separator />
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Before you hand it over</h3>
          <ul className="flex list-disc flex-col gap-2 pl-4 text-sm leading-relaxed text-muted-foreground">
            <li>Describe the condition honestly, including known faults.</li>
            <li>Attach an invoice, receipt, or ownership-transfer document. Bring the original and your student ID for verification.</li>
            <li>If the document is in someone else&apos;s name, provide evidence of the transfer to you. Ask the team about alternatives if you have no receipt.</li>
            <li>Agree on a handover time; do not leave a cycle unattended at a station.</li>
          </ul>
        </div>
      </CardContent>
      <CardFooter>
        <p className="text-sm leading-relaxed text-muted-foreground">The transport team makes the final decision after inspection. A draft is not an acceptance or a transfer of ownership.</p>
      </CardFooter>
    </Card>
  )
}
