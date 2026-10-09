import { createClient } from "@/lib/supabase/client"
import type { AppNotification } from "./types"

interface NotificationRow {
  id: string
  user_id: string | null
  type: AppNotification["type"]
  title: string
  message: string
  read: boolean
  created_at: string
}

function validateUserId(userId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) throw new Error("A valid session is required.")
}

export async function fetchNotificationsFromDb(userId: string): Promise<AppNotification[]> {
  validateUserId(userId)
  const { data, error } = await createClient().from("notifications")
    .select("id, user_id, type, title, message, read, created_at")
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order("created_at", { ascending: false })
    .limit(100)
  if (error) throw new Error("Unable to load notifications.")
  return ((data ?? []) as NotificationRow[]).map((row) => ({ id: row.id, userId: row.user_id, type: row.type, title: row.title, message: row.message, read: row.read, time: row.created_at }))
}

export async function markPersonalNotificationsReadInDb(userId: string) {
  validateUserId(userId)
  const { error } = await createClient().from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false)
  if (error) throw new Error("Unable to mark notifications as read.")
}
