import { cn } from "@/lib/utils"

export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth={2}>
        <circle cx="6" cy="17" r="3.2" />
        <circle cx="18" cy="17" r="3.2" />
        <path d="M6 17 L10.5 8 H15" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 8 H13 L18 17" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 8 L15 5" strokeLinecap="round" />
      </svg>
    </div>
  )
}

export function BrandWordmark({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark />
      {!collapsed && (
        <div className="flex flex-col leading-none">
          <span className="text-sm font-semibold tracking-tight">CycleNet</span>
          <span className="text-[11px] text-muted-foreground">NIT Trichy</span>
        </div>
      )}
    </div>
  )
}
