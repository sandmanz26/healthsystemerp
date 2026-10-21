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
    <div className="dark min-h-screen bg-[oklch(0.18_0.02_200)] p-6 text-white sm:p-10" data-theme="dark">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Logo compact />
          <div>
            <div className="text-2xl font-bold">{facility}</div>
            <div className="text-white/60">Antrean rawat jalan</div>
          </div>
        </div>
        <div className="text-right">
          <div className="tabular text-4xl font-bold">{formatTime(new Date(now).toISOString())}</div>
          <div className="text-white/60">{formatDateLong(new Date(now))}</div>
        </div>
      </header>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {boards.map(({ unit, called, next, waiting }) => (
          <section key={unit.id} className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            <h2 className="text-xl font-semibold text-white/80">{unit.name}</h2>
            <div className="mt-4 text-sm uppercase tracking-widest text-white/50">Dipanggil</div>
            <div className="tabular text-7xl font-extrabold tracking-tight text-[oklch(0.8_0.12_186)]" aria-live="polite">
              {called?.queueNumber ?? "—"}
            </div>
            <div className="mt-5 text-sm uppercase tracking-widest text-white/50">Berikutnya</div>
            <div className="tabular mt-1 flex gap-3 text-2xl font-bold text-white/90">{next.length ? next.map((e) => <span key={e.id}>{e.queueNumber}</span>) : <span className="text-white/40">—</span>}</div>
            <div className="mt-4 text-sm text-white/50">{waiting} orang menunggu</div>
          </section>
        ))}
      </div>
    </div>
  )
}
