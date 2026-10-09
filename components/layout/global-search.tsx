"use client"

import { Bike, MapPin, Route, Search, User } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useStore } from "@/lib/store"

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { bikes, stations, rides, role } = useStore()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  const users = useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of rides) if (!seen.has(r.userId)) seen.set(r.userId, r.userName)
    return [...seen.entries()].slice(0, 8)
  }, [rides])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-full items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground transition-colors hover:bg-accent/50 sm:w-64"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline">⌘K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search bicycles, stations, rides, users…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Stations">
            {stations.slice(0, 6).map((s) => (
              <CommandItem key={s.id} value={`station ${s.name}`} onSelect={() => go("/stations")}>
                <MapPin />
                <span>{s.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {s.available}/{s.capacity}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Bicycles">
            {bikes.slice(0, 8).map((b) => (
              <CommandItem
                key={b.id}
                value={`bike ${b.id} ${b.model}`}
                onSelect={() => go(role === "admin" ? "/bikes" : "/scan")}
              >
                <Bike />
                <span className="font-mono">{b.id}</span>
                <span className="ml-auto text-xs capitalize text-muted-foreground">{b.status}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Recent rides">
            {rides.slice(0, 6).map((r) => (
              <CommandItem key={r.id} value={`ride ${r.id} ${r.userName} ${r.bikeId}`} onSelect={() => go("/rides")}>
                <Route />
                <span className="font-mono">{r.id}</span>
                <span className="ml-auto text-xs text-muted-foreground">{r.bikeId}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Users">
            {users.map(([id, name]) => (
              <CommandItem key={id} value={`user ${name}`} onSelect={() => go("/rides")}>
                <User />
                <span>{name}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">{id}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
