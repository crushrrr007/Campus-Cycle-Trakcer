"use client"

import { useEffect, useRef, useState } from "react"
import { distanceMeters, validCoordinates, type Coordinates } from "@/lib/station-navigation"

export function useCampusLocation() {
  const [gps, setGps] = useState<Coordinates | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [originId, setOriginId] = useState("")
  const [locating, setLocating] = useState(false)
  const [locateSignal, setLocateSignal] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const request = useRef(0)
  const pending = useRef(false)
  useEffect(() => () => { request.current += 1; pending.current = false }, [])

  function locate() {
    if (pending.current) return
    if (!navigator.geolocation) { setMessage("This browser does not support location."); return }
    if (!window.isSecureContext) { setMessage("Location requires a secure browser connection."); return }
    pending.current = true
    setLocating(true)
    setMessage(null)
    const id = ++request.current
    navigator.geolocation.getCurrentPosition((position) => {
      if (id !== request.current) return
      pending.current = false
      setLocating(false)
      const point = { lat: position.coords.latitude, lng: position.coords.longitude }
      if (!validCoordinates(point)) { setMessage("The browser returned an invalid location."); return }
      setGps(point)
      setAccuracy(position.coords.accuracy)
      setOriginId("gps")
      setLocateSignal((value) => value + 1)
      setMessage(distanceMeters(point, { lat: 10.7606, lng: 78.8155 }) > 3000 ? "Your location appears outside the campus area." : position.coords.accuracy > 200 ? "Location accuracy is low; nearby recommendations are approximate." : null)
    }, (error) => {
      if (id !== request.current) return
      pending.current = false
      setLocating(false)
      setMessage(error.code === 1 ? "Location permission was denied. No location was saved." : error.code === 3 ? "Location request timed out. Try again." : "Your location is unavailable right now.")
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 })
  }
  return { gps, accuracy, originId, setOriginId, locating, locateSignal, message, locate }
}
