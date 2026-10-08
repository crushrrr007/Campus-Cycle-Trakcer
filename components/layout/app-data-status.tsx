"use client"

import { useState } from "react"
import { toast } from "sonner"
import { AlertCircle, Loader2 } from "lucide-react"
import { useStore } from "@/lib/store"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export function AppDataStatus() {
  const { dataLoading, dataError, refreshData } = useStore()
  const [retrying, setRetrying] = useState(false)

  async function retry() {
    setRetrying(true)
    try {
      await refreshData()
    } catch {
      toast.error("Campus data is still unavailable. Please try again.")
    } finally {
      setRetrying(false)
    }
  }

  if (dataError) {
    return (
      <Alert variant="destructive">
        <AlertCircle aria-hidden="true" />
        <AlertTitle>Campus data could not be loaded</AlertTitle>
        <AlertDescription>
          <p>Some information may be unavailable or out of date. Check your connection and retry.</p>
          <Button variant="outline" size="sm" disabled={retrying} onClick={retry}>
            {retrying && <Loader2 data-icon="inline-start" className="animate-spin" />}
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (dataLoading) {
    return <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Loading campus data…</p>
  }

  return null
}
