"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import { fetchNotificationsFromDb, markPersonalNotificationsReadInDb } from "@/lib/notifications-db"
import type { AppNotification } from "@/lib/types"

export function useNotifications(realMode: boolean, userId: string | undefined, seed: AppNotification[]) {
  const [local, setLocal] = useState(() => realMode ? [] : seed)
  const [markingRead, setMarkingRead] = useState(false)
  const pending = useRef(false)
  const { data, error, isLoading, mutate } = useSWR(realMode && userId ? ["db-notifications", userId] : null,
    ([, id]: [string, string]) => fetchNotificationsFromDb(id),
    { revalidateOnFocus: true, refreshInterval: 15000 })
  const notifications = useMemo(() => realMode ? data ?? [] : local, [realMode, data, local])
  const pushNotification = useCallback((notification: Omit<AppNotification, "id" | "time" | "read">) => {
    // Existing RLS allows only admins to insert. Real action receipts remain toasts;
    // the bell reads stored alerts without pretending a student receipt was saved.
    if (realMode) { void mutate().catch(() => undefined); return }
    setLocal((previous) => [{ ...notification, id: crypto.randomUUID(), time: new Date().toISOString(), read: false }, ...previous])
  }, [realMode, mutate])
  const markAllRead = useCallback(async () => {
    if (pending.current) return
    pending.current = true
    setMarkingRead(true)
    try {
      if (realMode && userId) {
        await markPersonalNotificationsReadInDb(userId)
        await mutate()
      } else setLocal((previous) => previous.map((notification) => ({ ...notification, read: true })))
    } finally { pending.current = false; setMarkingRead(false) }
  }, [realMode, userId, mutate])
  return { notifications, pushNotification, markAllRead, markingRead, notificationsLoading: realMode && isLoading, notificationsError: Boolean(error), refreshNotifications: mutate }
}
