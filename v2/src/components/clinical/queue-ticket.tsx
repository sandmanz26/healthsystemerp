import { cn } from "@v2/lib/cn"

/** A queue number printed like the thermal ticket the patient is holding. */
export function QueueTicket({ number, tone = "default", size = "sm" }: { number?: string; tone?: "default" | "accent" | "muted"; size?: "sm" | "lg" }) {
  if (!number) return null
  return (
    <span
      className={cn(
        "ticket num inline-flex items-center justify-center font-bold",
        size === "sm" ? "min-w-[4.75rem] px-2.5 py-1 text-[13px] [--notch:5px]" : "min-w-28 px-5 py-2 text-2xl [--notch:8px]",
        tone === "accent" ? "bg-accent text-accent-foreground" : tone === "muted" ? "bg-surface-secondary text-muted" : "bg-surface-tertiary text-foreground",
      )}
    >
      {number}
    </span>
  )
}
