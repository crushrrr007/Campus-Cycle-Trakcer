"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { freeDocks, isUsableStation } from "@/lib/station-navigation"
import QRCode from "qrcode"
import {
  QrCodeIcon,
  BikeIcon,
  ScanLineIcon,
  CheckCircle2Icon,
  MapPinIcon,
  ClockIcon,
} from "lucide-react"
import { useStore } from "@/lib/store"
import { QrCameraScanner } from "@/components/scan/qr-camera-scanner"
import { formatDateTime } from "@/lib/analytics"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

export function ScanView() {
  const { bikes, stations, myActiveRide, borrowBike, returnBike, getBike, stationName } = useStore()

  const availableBikes = useMemo(
    () => bikes.filter((b) => b.status === "available").slice(0, 8),
    [bikes],
  )

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {myActiveRide ? (
        <ReturnPanel
          ride={myActiveRide}
          stations={stations}
          stationName={stationName}
          getBike={getBike}
          onReturn={async (dest) => {
            const res = await returnBike(myActiveRide.bikeId, dest)
            if (res.ok) toast.success(res.message)
            else toast.error(res.message)
          }}
        />
      ) : (
        <BorrowPanel
          availableCodes={availableBikes.map((b) => b.id)}
          onBorrow={async (code) => {
            const res = await borrowBike(code)
            if (res.ok) toast.success(res.message)
            else toast.error(res.message)
          }}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
          <CardDescription>Borrow and return any campus bike in three steps.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Step
            n={1}
            icon={ScanLineIcon}
            title="Scan the bike QR"
            text="Each bike has a unique QR sticker on the frame. Enter its code or scan it here."
          />
          <Step
            n={2}
            icon={BikeIcon}
            title="Ride across campus"
            text="The bike is checked out to your account. The campus map shows updated station availability, not your ride location."
          />
          <Step
            n={3}
            icon={CheckCircle2Icon}
            title="Return at any station"
            text="Park at any docking station and confirm the return to end your ride."
          />
          <Separator />
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground">Available bikes you can borrow:</span>
            {availableBikes.slice(0, 5).map((b) => (
              <Badge key={b.id} variant="outline">
                {b.id}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function BorrowPanel({
  availableCodes,
  onBorrow,
}: {
  availableCodes: string[]
  onBorrow: (code: string) => Promise<void>
}) {
  const [code, setCode] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const pending = useRef(false)
  const suggestion = availableCodes[0] ?? ""

  async function submitBorrow(value: string) {
    if (pending.current || !value.trim()) return
    pending.current = true
    setSubmitting(true)
    try { await onBorrow(value.trim()) }
    catch { toast.error("Unable to borrow the bike. Please try again.") }
    finally { pending.current = false; setSubmitting(false) }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCodeIcon className="size-5 text-primary" />
          Borrow a bicycle
        </CardTitle>
        <CardDescription>Scan or type a bike code to check it out instantly.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <QrCameraScanner
          onDetected={(raw) => {
            // QR stickers encode "NITTBIKE:NITT-XXXX" — strip the prefix if present.
            const parsed = raw.startsWith("NITTBIKE:") ? raw.slice("NITTBIKE:".length) : raw
            setCode(parsed.toUpperCase())
            void submitBorrow(parsed.toUpperCase())
          }}
        />
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              placeholder="e.g. NITT-0001"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing || e.keyCode === 229) return
                if (e.key === "Enter" && code.trim()) void submitBorrow(code.trim())
              }}
            />
            <Button onClick={() => void submitBorrow(code)} disabled={!code.trim() || submitting}>
              {submitting ? "Borrowing…" : "Borrow"}
            </Button>
          </div>
          {suggestion && (
            <button
              type="button"
              className="self-start text-xs text-primary hover:underline"
              onClick={() => setCode(suggestion)}
            >
              Try {suggestion}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ReturnPanel({
  ride,
  stations,
  stationName,
  getBike,
  onReturn,
}: {
  ride: ReturnType<typeof useStore>["myActiveRide"]
  stations: ReturnType<typeof useStore>["stations"]
  stationName: (id: string | null) => string
  getBike: ReturnType<typeof useStore>["getBike"]
  onReturn: (dest: string) => Promise<void>
}) {
  const [dest, setDest] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const pending = useRef(false)
  const selectedStation = stations.find((station) => station.id === dest)
  const canReturn = !!selectedStation && isUsableStation(selectedStation, "return")
  const [qr, setQr] = useState<string>("")

  async function submitReturn() {
    if (pending.current || !canReturn) return
    pending.current = true
    setSubmitting(true)
    try { await onReturn(dest) }
    catch { toast.error("Unable to return the bike. Please try again.") }
    finally { pending.current = false; setSubmitting(false) }
  }
  const bike = ride ? getBike(ride.bikeId) : undefined

  useEffect(() => {
    if (bike) {
      QRCode.toDataURL(bike.qr, { width: 220, margin: 1, color: { dark: "#0a0f0c", light: "#ffffff" } })
        .then(setQr)
        .catch(() => setQr(""))
    }
  }, [bike])

  if (!ride) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BikeIcon className="size-5 text-primary" />
          Active ride
        </CardTitle>
        <CardDescription>Your bike is checked out. Return it at any station.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-muted/40 py-5">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr || "/placeholder.svg"} alt={`QR code for ${ride.bikeId}`} className="size-36 rounded-lg" />
          ) : (
            <div className="size-36 animate-pulse rounded-lg bg-muted" />
          )}
          <Badge variant="secondary" className="font-mono">
            {ride.bikeId}
          </Badge>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <Row icon={MapPinIcon} label="Borrowed from" value={stationName(ride.sourceStationId)} />
          <Row icon={ClockIcon} label="Borrow time" value={formatDateTime(ride.borrowTime)} />
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <label htmlFor="return-station" className="text-sm font-medium">Return to station</label>
          <Select
            value={dest}
            onValueChange={(v) => v && setDest(v)}
            items={stations.map((s) => ({ value: s.id, label: `${s.name} · ${s.capacity <= 0 || s.status === "offline" ? "Offline" : `${freeDocks(s)} free docks`}` }))}
          >
            <SelectTrigger id="return-station" className="w-full">
              <SelectValue placeholder="Choose a station" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>{stations.map((s) => (
                <SelectItem key={s.id} value={s.id} disabled={!isUsableStation(s, "return")}>
                  {s.name} · {s.capacity <= 0 || s.status === "offline" ? "Offline" : `${freeDocks(s)} free docks`}
                </SelectItem>
              ))}</SelectGroup>
            </SelectContent>
          </Select>
          {dest && !canReturn && <p role="alert" className="text-sm text-muted-foreground">This station no longer has an open dock. Choose another destination.</p>}
          <p className="text-sm leading-relaxed text-muted-foreground">Bikes under maintenance also occupy docks and are excluded from the free-dock count. Availability is checked again when you confirm.</p>
          <Button onClick={() => void submitReturn()} disabled={!canReturn || submitting}>
            <CheckCircle2Icon data-icon="inline-start" />
            {submitting ? "Returning…" : "Confirm return"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Row({ icon: Icon, label, value }: { icon: typeof MapPinIcon; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function Step({
  n,
  icon: Icon,
  title,
  text,
}: {
  n: number
  icon: typeof BikeIcon
  title: string
  text: string
}) {
  return (
    <div className="flex gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4.5" />
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="text-xs text-muted-foreground">Step {n}</span>
          {title}
        </span>
        <span className="text-sm text-muted-foreground">{text}</span>
      </div>
    </div>
  )
}
