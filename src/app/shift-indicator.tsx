import { formatTime } from "@/lib/format"
import { shiftAt } from "@/lib/shift"
import { useNow } from "@/lib/use-now"

/** "Day shift · 07:00–19:00" with elapsed bar — the clock every ward runs on. */
export function ShiftIndicator() {
  const now = useNow(30_000)
  const shift = shiftAt(now)
  return (
    <div className="hidden items-center gap-3 rounded-xl border border-border bg-surface px-3 py-1.5 md:flex" title={`${Math.floor(shift.remainingMin / 60)} h ${shift.remainingMin % 60} min left in shift`}>
      <div className="leading-tight">
        <div className="label-caps text-muted">{shift.label} shift</div>
        <div className="num text-xs">
          {shift.start}–{shift.end}
        </div>
      </div>
      <div className="h-7 w-1.5 overflow-hidden rounded-full bg-surface-tertiary" aria-hidden>
        <div className="w-full rounded-full bg-accent" style={{ height: `${Math.round(shift.progress * 100)}%` }} />
      </div>
      <div className="num text-lg font-semibold">{formatTime(new Date(now).toISOString())}</div>
    </div>
  )
}
