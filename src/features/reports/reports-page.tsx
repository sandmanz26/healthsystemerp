/**
 * Management reports: activity, inpatient efficiency (Barber-Johnson), revenue by payer
 * and the top diagnoses — the numbers asked for in RL/SIRS reporting and board meetings.
 * Sections whose source module is off are omitted rather than shown empty.
 */
import { Chip } from "@heroui/react"
import { Activity, BedDouble, Clock, RefreshCcw, Wallet } from "lucide-react"
import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { axisProps, gridProps, SERIES } from "@/components/chart-theme"
import { ChartLegend, ChartTooltip } from "@/components/charts"
import { Page, PageHeader } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import { Segmented } from "@/components/ui/segmented"
import { Stat } from "@/components/ui/stat"
import { invoiceTotal } from "@/domain/finance"
import { IDEAL, censusIndicators } from "@/domain/indicators"
import type { EncounterKind, PayerType } from "@/domain/types"
import { dayKey, formatNumber, formatPercent, formatRupiah } from "@/lib/format"
import { useNow } from "@/lib/use-now"
import { useStore } from "@/store"
import { useModuleEnabled } from "@/store/selectors"

const DAY = 86400000
const KINDS: { kind: EncounterKind; label: string }[] = [
  { kind: "outpatient", label: "Rawat jalan" },
  { kind: "emergency", label: "IGD" },
  { kind: "inpatient", label: "Rawat inap (masuk)" },
]
const PAYERS: { payer: PayerType; label: string }[] = [
  { payer: "bpjs", label: "BPJS" },
  { payer: "umum", label: "Umum" },
  { payer: "asuransi", label: "Asuransi" },
]
const shortDay = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" })

function inRange(value: number, [lo, hi]: readonly [number, number]) {
  return value >= lo && value <= hi
}

export default function ReportsPage() {
  const encounters = useStore((s) => s.encounters)
  const invoices = useStore((s) => s.invoices)
  const beds = useStore((s) => s.beds)
  const inpatientOn = useModuleEnabled("inpatient")
  const billingOn = useModuleEnabled("billing")
  const [days, setDays] = useState<"7" | "30">("30")
  const now = useNow(60_000)
  const start = now - Number(days) * DAY

  const inPeriod = useMemo(() => encounters.filter((e) => e.status !== "cancelled" && new Date(e.createdAt).getTime() >= start), [encounters, start])

  const daily = useMemo(() => {
    const rows = Array.from({ length: Number(days) }, (_, i) => {
      const d = new Date(now - (Number(days) - 1 - i) * DAY)
      return { key: dayKey(d), label: shortDay.format(d), outpatient: 0, emergency: 0, inpatient: 0 }
    })
    const byKey = new Map(rows.map((r) => [r.key, r]))
    for (const e of inPeriod) {
      const r = byKey.get(dayKey(e.createdAt))
      if (r) r[e.kind] += 1
    }
    return rows
  }, [inPeriod, days, now])

  const census = useMemo(() => {
    const inpatients = encounters.filter((e) => e.kind === "inpatient" && e.status !== "cancelled")
    let patientDays = 0
    for (const e of inpatients) {
      const s = Math.max(start, new Date(e.startedAt ?? e.createdAt).getTime())
      const end = Math.min(now, e.endedAt ? new Date(e.endedAt).getTime() : now)
      if (end > s) patientDays += (end - s) / DAY
    }
    const discharged = inpatients.filter((e) => e.status === "finished" && e.endedAt && new Date(e.endedAt).getTime() >= start)
    const deaths = discharged.filter((e) => e.disposition === "meninggal")
    const los = (e: (typeof discharged)[number]) => (new Date(e.endedAt!).getTime() - new Date(e.startedAt ?? e.createdAt).getTime()) / DAY
    return censusIndicators({
      beds: beds.length,
      periodDays: Number(days),
      patientDays,
      discharges: discharged.length,
      deaths: deaths.length,
      deathsOver48h: deaths.filter((e) => los(e) > 2).length,
      totalLos: discharged.reduce((s, e) => s + los(e), 0),
    })
  }, [encounters, beds.length, start, now, days])
  const btoYear = census.bto * (365 / Number(days))

  const revenue = useMemo(() => {
    const rows = PAYERS.map((p) => ({ ...p, total: 0, count: 0 }))
    for (const inv of invoices) {
      if (inv.status === "void" || new Date(inv.createdAt).getTime() < start) continue
      const r = rows.find((x) => x.payer === inv.payer)!
      r.total += invoiceTotal(inv)
      r.count += 1
    }
    return rows
  }, [invoices, start])
  const revenueTotal = revenue.reduce((s, r) => s + r.total, 0)

  const topDx = useMemo(() => {
    const m = new Map<string, { code: string; display: string; n: number }>()
    for (const e of inPeriod)
      for (const d of e.diagnoses.filter((x) => x.primary)) {
        const cur = m.get(d.code) ?? { code: d.code, display: d.display, n: 0 }
        cur.n += 1
        m.set(d.code, cur)
      }
    return [...m.values()].sort((a, b) => b.n - a.n).slice(0, 10)
  }, [inPeriod])
  const maxDx = topDx[0]?.n ?? 1

  return (
    <Page>
      <PageHeader
        title="Laporan & Analitik"
        description="Angka dihitung langsung dari data layanan, tanpa input ulang."
        actions={<Segmented label="Periode" value={days} onChange={setDays} options={[{ value: "7", label: "7 hari" }, { value: "30", label: "30 hari" }]} />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Kunjungan rawat jalan" value={formatNumber(inPeriod.filter((e) => e.kind === "outpatient").length)} icon={Activity} tone="accent" />
        <Stat label="Kunjungan IGD" value={formatNumber(inPeriod.filter((e) => e.kind === "emergency").length)} icon={Activity} />
        <Stat label="Pasien masuk rawat inap" value={formatNumber(inPeriod.filter((e) => e.kind === "inpatient").length)} icon={BedDouble} />
        {billingOn && <Stat label="Pendapatan (tagihan)" value={formatRupiah(revenueTotal)} icon={Wallet} tone="success" />}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Kunjungan per hari" description="Menurut jenis layanan" className="xl:col-span-2">
          <ChartLegend items={KINDS.map((k, i) => ({ label: k.label, color: SERIES[i] }))} />
          <div className="mt-3 h-72" role="img" aria-label="Grafik kunjungan per hari">
            <ResponsiveContainer>
              <BarChart data={daily} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap={days === "7" ? "30%" : "15%"}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...axisProps} interval={days === "7" ? 0 : 4} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--chart-grid)" }} />
                {KINDS.map((k, i) => (
                  <Bar key={k.kind} dataKey={k.kind} name={k.label} stackId="v" fill={SERIES[i]} stroke="var(--surface)" strokeWidth={1} radius={i === KINDS.length - 1 ? [4, 4, 0, 0] : 0} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {billingOn && (
          <Panel title="Pendapatan per penjamin" description={`${days} hari terakhir`}>
            <ul className="space-y-4">
              {revenue.map((r, i) => (
                <li key={r.payer}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-sm" style={{ background: SERIES[i] }} aria-hidden />
                      {r.label}
                    </span>
                    <span className="tabular font-semibold">{formatRupiah(r.total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-secondary">
                    <div className="h-full rounded-full" style={{ width: `${revenueTotal ? (r.total / revenueTotal) * 100 : 0}%`, background: SERIES[i] }} />
                  </div>
                  <div className="tabular mt-1 text-xs text-muted">
                    {formatPercent(revenueTotal ? (r.total / revenueTotal) * 100 : 0)} · {r.count} tagihan
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {inpatientOn && (
          <Panel title="Indikator rawat inap (Barber-Johnson)" description={`${beds.length} tempat tidur · ${days} hari`} className="xl:col-span-2">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Indicator label="BOR" value={formatPercent(census.bor)} ideal="60–85%" ok={inRange(census.bor, IDEAL.bor)} icon={BedDouble} />
              <Indicator label="ALOS" value={`${formatNumber(census.alos)} hari`} ideal="6–9 hari" ok={inRange(census.alos, IDEAL.alos)} icon={Clock} />
              <Indicator label="TOI" value={`${formatNumber(census.toi)} hari`} ideal="1–3 hari" ok={inRange(census.toi, IDEAL.toi)} icon={RefreshCcw} />
              <Indicator label="BTO (setahun)" value={`${formatNumber(btoYear)} kali`} ideal="40–50 kali" ok={inRange(btoYear, IDEAL.bto)} icon={RefreshCcw} />
            </div>
            <div className="tabular mt-3 flex flex-wrap gap-4 text-sm text-muted">
              <span>NDR {formatNumber(census.ndr)}‰ (ideal &lt; 25‰)</span>
              <span>GDR {formatNumber(census.gdr)}‰ (ideal &lt; 45‰)</span>
            </div>
          </Panel>
        )}

        <Panel title="10 diagnosis terbanyak" description="Diagnosis utama, semua layanan" className={inpatientOn ? undefined : "xl:col-span-3"}>
          {topDx.length === 0 ? (
            <p className="text-sm text-muted">Belum ada data.</p>
          ) : (
            <ol className="space-y-2.5">
              {topDx.map((d) => (
                <li key={d.code}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">
                      <b className="tabular">{d.code}</b> {d.display}
                    </span>
                    <span className="tabular font-semibold">{d.n}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-surface-secondary">
                    <div className="h-full rounded-full" style={{ width: `${(d.n / maxDx) * 100}%`, background: SERIES[0] }} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </Page>
  )
}

function Indicator({ label, value, ideal, ok, icon: Icon }: { label: string; value: string; ideal: string; ok: boolean; icon: typeof BedDouble }) {
  return (
    <div className="rounded-xl bg-surface-secondary p-3">
      <div className="flex items-center justify-between text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <Icon className="size-3.5" aria-hidden /> {label}
        </span>
        <Chip size="sm" variant="soft" color={ok ? "success" : "warning"}>
          {ok ? "Ideal" : "Di luar ideal"}
        </Chip>
      </div>
      <div className="tabular mt-1 text-xl font-bold">{value}</div>
      <div className="text-xs text-muted">Ideal {ideal}</div>
    </div>
  )
}
