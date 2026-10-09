"use client"

import { useState } from "react"
import useSWR from "swr"
import { ClipboardCheckIcon, RefreshCwIcon } from "lucide-react"
import { donationRequest } from "@/lib/donation-client"
import { donationStatus, type DonationList } from "@/lib/donations"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export function DonationInbox({ admin = false, busy = false, selectedId, onOpen }: {
  admin?: boolean
  busy?: boolean
  selectedId?: string
  onOpen?: (id: string) => void
}) {
  const [page, setPage] = useState(0)
  const { data, error, isLoading, isValidating, mutate } = useSWR<DonationList>(
    `/api/donations?scope=${admin ? "admin" : "student"}&page=${page}`,
    donationRequest,
    { refreshInterval: 20000, revalidateOnFocus: true },
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>{admin ? "Donation inbox" : "Your submitted donations"}</CardTitle>
          <Button type="button" variant="outline" size="sm" disabled={isValidating} onClick={() => void mutate()}><RefreshCwIcon data-icon="inline-start" />Refresh</Button>
        </div>
        <CardDescription>{admin ? "Student submissions saved in Supabase. Open a request to inspect its ownership document and save your assessment." : "Saved requests and the transport team’s latest assessment. Updates refresh automatically while this page is open."}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4" aria-busy={isLoading}>
        {error ? <Alert variant="destructive"><AlertTitle>Could not load donations</AlertTitle><AlertDescription>{error.message}</AlertDescription></Alert> : isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">Loading donations…</p>
        ) : !data?.donations.length ? (
          <Empty><EmptyHeader><EmptyMedia variant="icon"><ClipboardCheckIcon /></EmptyMedia><EmptyTitle>{page ? "No more donations" : "No submissions yet"}</EmptyTitle><EmptyDescription>{admin ? "Requests submitted online by students will appear here. Downloaded drafts must still be shared manually." : "Complete the form and choose Submit donation to send your request to the transport team."}</EmptyDescription></EmptyHeader></Empty>
        ) : (
          <ul className="flex flex-col gap-4">
            {data.donations.map((donation) => (
              <li key={donation.id} className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <h3 className="break-words text-sm font-medium">{donation.details.brand} · {donation.details.model}</h3>
                    <p className="text-sm text-muted-foreground">{admin ? `${donation.details.donorName} · ` : ""}{new Date(donation.createdAt).toLocaleDateString("en-IN")}</p>
                    <p className="break-all text-sm text-muted-foreground">Reference: {donation.id}</p>
                  </div>
                  <Badge variant={donation.assessment ? "secondary" : "outline"}>{donationStatus(donation.assessment)}</Badge>
                </div>
                {donation.assessment && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{donation.assessment.notes}</p>}
                {onOpen && <Button type="button" variant={selectedId === donation.id ? "secondary" : "outline"} className="self-start" disabled={busy} onClick={() => onOpen(donation.id)}>{selectedId === donation.id ? "Reopen latest assessment" : "Open request"}</Button>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {(page > 0 || data?.hasMore) && <CardFooter className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" disabled={page === 0 || isLoading} onClick={() => setPage((value) => value - 1)}>Previous</Button>
        <span className="text-sm text-muted-foreground">Page {page + 1}</span>
        <Button type="button" variant="outline" disabled={!data?.hasMore || isLoading} onClick={() => setPage((value) => value + 1)}>Next</Button>
      </CardFooter>}
    </Card>
  )
}
