"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import jsQR from "jsqr"
import { CameraIcon, CameraOffIcon, ScanLineIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

type ScannerState = "idle" | "starting" | "scanning" | "denied" | "unavailable"

export function QrCameraScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const detectedRef = useRef(false)
  const [state, setState] = useState<ScannerState>("idle")

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const scanLoop = useCallback(() => {
    const video = videoRef.current
    if (!video || detectedRef.current) return
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      if (!canvasRef.current) canvasRef.current = document.createElement("canvas")
      const canvas = canvasRef.current
      // Downscale for faster decoding on mobile
      const scale = Math.min(1, 640 / video.videoWidth)
      canvas.width = Math.floor(video.videoWidth * scale)
      canvas.height = Math.floor(video.videoHeight * scale)
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      if (ctx && canvas.width > 0 && canvas.height > 0) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const result = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        })
        if (result?.data) {
          detectedRef.current = true
          stopCamera()
          setState("idle")
          onDetected(result.data.trim())
          return
        }
      }
    }
    rafRef.current = requestAnimationFrame(scanLoop)
  }, [onDetected, stopCamera])

  const startCamera = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("unavailable")
      return
    }
    setState("starting")
    detectedRef.current = false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      video.srcObject = stream
      await video.play()
      setState("scanning")
      rafRef.current = requestAnimationFrame(scanLoop)
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ""
      setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable")
      stopCamera()
    }
  }, [scanLoop, stopCamera])

  useEffect(() => stopCamera, [stopCamera])

  const active = state === "starting" || state === "scanning"

  return (
    <div className="flex flex-col items-center gap-3 overflow-hidden rounded-xl border border-dashed bg-muted/40">
      {active ? (
        <div className="relative w-full">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            playsInline
            muted
            className="aspect-video w-full bg-foreground/90 object-cover"
            aria-label="Live camera feed for QR scanning"
          />
          {/* Scan frame overlay */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="size-40 rounded-2xl border-2 border-primary-foreground/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
          <div className="absolute inset-x-0 bottom-2 flex justify-center">
            <span className="rounded-full bg-background/85 px-3 py-1 text-xs font-medium">
              {state === "starting" ? "Starting camera…" : "Point at the bike QR sticker"}
            </span>
          </div>
          <Button
            size="icon-sm"
            variant="secondary"
            className="absolute top-2 right-2"
            onClick={() => {
              stopCamera()
              setState("idle")
            }}
            aria-label="Stop camera"
          >
            <XIcon />
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-8">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {state === "denied" || state === "unavailable" ? (
              <CameraOffIcon className="size-8" />
            ) : (
              <ScanLineIcon className="size-8" />
            )}
          </span>
          {state === "denied" ? (
            <p className="max-w-60 text-center text-sm text-muted-foreground">
              Camera access was blocked. Allow camera permission in your browser, or enter the code
              manually below.
            </p>
          ) : state === "unavailable" ? (
            <p className="max-w-60 text-center text-sm text-muted-foreground">
              No camera found on this device. Enter the bike code manually below.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Scan the QR sticker on the bike frame</p>
          )}
          <Button onClick={startCamera}>
            <CameraIcon data-icon="inline-start" />
            {state === "denied" || state === "unavailable" ? "Try again" : "Open camera"}
          </Button>
        </div>
      )}
    </div>
  )
}
