export async function donationRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  })
  const result = await response.json()
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Could not connect to donation storage. Try again.")
  return result as T
}

export const isDonationListKey = (key: unknown) => typeof key === "string" && key.startsWith("/api/donations?")
