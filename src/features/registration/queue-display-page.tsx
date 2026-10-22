/**
 * Waiting-room TV. Large type, high contrast, no interaction. Shows the number currently
 * called per poli and who is next — reduces "sudah dipanggil belum?" questions at the desk.
 */
import { useMemo } from "react"
import { Logo } from "@/app/logo"
import { dayKey, formatDateLong, formatTime } from "@/lib/format"
import { useNow } from "@/lib/use-now"
import { useStore } from "@/store"

export default function QueueDisplayPage() {
  const encounters = useStore((s) => s.encounters)
  const units = useStore((s) => s.units)
  const facility = useStore((s) => s.facility.name)
  const now = useNow(5000)

  const boards = useMemo(() => {
    const today = encounters.filter((e) => e.kind === "outpatient" && dayKey(e.createdAt) === dayKey(now))
    return units
      .filter((u) => u.kind === "poli")
      .map((u) => {
        const mine = today.filter((e) => e.unitId === u.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        const called = mine.filter((e) => e.calledAt).sort((a, b) => b.calledAt!.localeCompare(a.calledAt!))[0]
        const next = mine.filter((e) => e.status === "registered").slice(0, 3)
        return { unit: u, called, next, waiting: mine.filter((e) => e.status === "registered").length }
      })
      .filter((b) => b.called || b.next.length)
  }, [encounters, units, now])

  return (
    <div className="dark bg-grid min-h-screen bg-background p-6 text-white sm:p-10" data-theme="dark">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Logo compact />
          <div>
            <div className="font-display text-3xl font-semibold">{facility}</div>
            <div className="text-white/60">Antrean rawat jalan</div>
          </div>
        </div>
        <div className="text-right">
          <div className="num text-5xl font-semibold">{formatTime(new Date(now).toISOString())}</div>
          <div className="text-white/60">{formatDateLong(new Date(now))}</div>
        </div>
      </header>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {boards.map(({ unit, called, next, waiting }) => (
          <section key={unit.id} className="rounded-2xl bg-surface p-6 ring-1 ring-white/10">
            <h2 className="text-2xl font-semibold text-white/85">{unit.name}</h2>
            <div className="label-caps mt-5 text-white/50">Dipanggil</div>
            <div className="ticket num mt-2 inline-block bg-accent px-8 py-3 text-7xl font-bold tracking-tight text-accent-foreground [--notch:12px]" aria-live="polite">
              {called?.queueNumber ?? "—"}
            </div>
            <div className="label-caps mt-6 text-white/50">Berikutnya</div>
            <div className="mt-2 flex gap-2">
              {next.length ? (
                next.map((e) => (
                  <span key={e.id} className="ticket num bg-white/10 px-4 py-1.5 text-2xl font-bold text-white/90 [--notch:6px]">
                    {e.queueNumber}
                  </span>
                ))
              ) : (
                <span className="text-2xl text-white/40">—</span>
              )}
            </div>
            <div className="num mt-4 text-sm text-white/50">{waiting} orang menunggu</div>
          </section>
        ))}
      </div>
    </div>
  )
}
