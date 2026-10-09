export async function donationRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    signal: init?.signal ?? AbortSignal.timeout(30000),
    headers: { "Content-Type": "application/json", ...init?.headers },
  })
  let result
  try { result = await response.json() } catch { throw new Error("Could not connect to donation storage. Keep your draft and try again.") }
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Could not connect to donation storage. Try again.")
  return result as T
}

export const isDonationListKey = (key: unknown) => typeof key === "string" && key.startsWith("/api/donations?")
