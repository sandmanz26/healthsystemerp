/**
 * Management reports: activity, inpatient flow (occupancy, ALOS, turnover), revenue by payer
 * and the top diagnoses — the numbers asked for at board meetings and in regulatory returns
 * (AHA Annual Survey / CMS cost report in the US; NHS SitRep & KH03 bed returns in England).
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
import { PAYERS_BY_REGION, PAYER_LABEL, invoiceTotal } from "@/domain/finance"
import { IDEAL, censusIndicators } from "@/domain/indicators"
import { REGIONS, type Region } from "@/domain/region"
import type { EncounterKind } from "@/domain/types"
import { dayKey, formatMoney, formatNumber, formatPercent } from "@/lib/format"
import { useNow } from "@/lib/use-now"
import { useStore } from "@/store"
import { useModuleEnabled, useRegion } from "@/store/selectors"

const DAY = 86400000
const KINDS: Record<Region, { kind: EncounterKind; label: string }[]> = {
  us: [
    { kind: "outpatient", label: "Outpatient visits" },
    { kind: "emergency", label: "ED visits" },
    { kind: "inpatient", label: "Admissions" },
  ],
  uk: [
    { kind: "outpatient", label: "Outpatient attendances" },
    { kind: "emergency", label: "A&E attendances" },
    { kind: "inpatient", label: "Admissions" },
  ],
}
const PALETTE = [...SERIES, "var(--muted)"]
const range = ([lo, hi]: readonly [number, number], unit = "") => `${lo}–${hi}${unit}`

function inRange(value: number, [lo, hi]: readonly [number, number]) {
  return value >= lo && value <= hi
}

export default function ReportsPage() {
  const encounters = useStore((s) => s.encounters)
  const invoices = useStore((s) => s.invoices)
  const beds = useStore((s) => s.beds)
  const inpatientOn = useModuleEnabled("inpatient")
  const billingOn = useModuleEnabled("billing")
  const region = useRegion()
  const kinds = KINDS[region]
  const shortDay = useMemo(() => new Intl.DateTimeFormat(REGIONS[region].locale, { day: "numeric", month: "short" }), [region])
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
  }, [inPeriod, days, now, shortDay])

  const census = useMemo(() => {
    const inpatients = encounters.filter((e) => e.kind === "inpatient" && e.status !== "cancelled")
    let patientDays = 0
    for (const e of inpatients) {
      const s = Math.max(start, new Date(e.startedAt ?? e.createdAt).getTime())
      const end = Math.min(now, e.endedAt ? new Date(e.endedAt).getTime() : now)
      if (end > s) patientDays += (end - s) / DAY
    }
    const discharged = inpatients.filter((e) => e.status === "finished" && e.endedAt && new Date(e.endedAt).getTime() >= start)
    const deaths = discharged.filter((e) => e.disposition === "expired")
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
  // Turnover normalised to a 30-day month so 7- and 30-day views compare against one range.
  const bto30 = census.bto * (30 / Number(days))

  const revenue = useMemo(() => {
    const rows = PAYERS_BY_REGION[region].map((payer) => ({ payer, label: PAYER_LABEL[payer], total: 0, count: 0 }))
    for (const inv of invoices) {
      if (inv.status === "void" || new Date(inv.createdAt).getTime() < start) continue
      const r = rows.find((x) => x.payer === inv.payer)
      if (!r) continue
      r.total += invoiceTotal(inv)
      r.count += 1
    }
    return rows
  }, [invoices, start, region])
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
  const dxLabel = REGIONS[region].dxSystem.split(" ")[0]

  return (
    <Page>
      <PageHeader
        title="Reports & Analytics"
        description="Calculated directly from clinical and financial activity — no re-keying."
        actions={<Segmented label="Period" value={days} onChange={setDays} options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }]} />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={kinds[0].label} value={formatNumber(inPeriod.filter((e) => e.kind === "outpatient").length)} icon={Activity} tone="accent" />
        <Stat label={kinds[1].label} value={formatNumber(inPeriod.filter((e) => e.kind === "emergency").length)} icon={Activity} />
        <Stat label={kinds[2].label} value={formatNumber(inPeriod.filter((e) => e.kind === "inpatient").length)} icon={BedDouble} />
        {billingOn && <Stat label={region === "us" ? "Gross charges" : "Activity value"} value={formatMoney(revenueTotal)} icon={Wallet} tone="success" />}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Daily activity" description="By setting of care" className="xl:col-span-2">
          <ChartLegend items={kinds.map((k, i) => ({ label: k.label, color: SERIES[i] }))} />
          <div className="mt-3 h-72" role="img" aria-label="Daily activity chart">
            <ResponsiveContainer>
              <BarChart data={daily} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap={days === "7" ? "30%" : "15%"}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...axisProps} interval={days === "7" ? 0 : 4} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--chart-grid)" }} />
                {kinds.map((k, i) => (
                  <Bar key={k.kind} dataKey={k.kind} name={k.label} stackId="v" fill={SERIES[i]} stroke="var(--surface)" strokeWidth={1} radius={i === kinds.length - 1 ? [4, 4, 0, 0] : 0} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {billingOn && (
          <Panel
            title={region === "us" ? "Charges by payer" : "Activity by funding source"}
            description={region === "us" ? `Gross charges · last ${days} days` : `Last ${days} days · NHS activity costed at indicative tariff (PLICS), private & overseas billed`}
          >
            <ul className="space-y-4">
              {revenue.map((r, i) => (
                <li key={r.payer}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-sm" style={{ background: PALETTE[i] }} aria-hidden />
                      {r.label}
                    </span>
                    <span className="num font-semibold">{formatMoney(r.total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-secondary">
                    <div className="h-full rounded-full" style={{ width: `${revenueTotal ? (r.total / revenueTotal) * 100 : 0}%`, background: PALETTE[i] }} />
                  </div>
                  <div className="num mt-1 text-xs text-muted">
                    {formatPercent(revenueTotal ? (r.total / revenueTotal) * 100 : 0)} · {r.count} account{r.count === 1 ? "" : "s"}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {inpatientOn && (
          <Panel title="Inpatient flow" description={`${beds.length} staffed beds · last ${days} days`} className="xl:col-span-2">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Indicator label="Bed occupancy" value={formatPercent(census.bor)} ideal={range(IDEAL.bor, "%")} ok={inRange(census.bor, IDEAL.bor)} icon={BedDouble} />
              <Indicator label="ALOS" value={`${formatNumber(census.alos)} days`} ideal={range(IDEAL.alos, " days")} ok={inRange(census.alos, IDEAL.alos)} icon={Clock} />
              <Indicator label="Turnover interval" value={`${formatNumber(census.toi)} days`} ideal={range(IDEAL.toi, " days")} ok={inRange(census.toi, IDEAL.toi)} icon={RefreshCcw} />
              <Indicator label="Bed turnover / 30 d" value={`${formatNumber(bto30)}×`} ideal={range(IDEAL.bto, "×")} ok={inRange(bto30, IDEAL.bto)} icon={RefreshCcw} />
            </div>
            <div className="num mt-3 flex flex-wrap gap-4 text-sm text-muted">
              <span>Crude mortality {formatNumber(census.gdr)}‰ discharges</span>
              <span>Deaths &gt; 48 h after admission {formatNumber(census.ndr)}‰</span>
            </div>
            <p className="label-caps mt-2 text-muted">Ranges: 85% occupancy safety threshold (Bagust, BMJ 1999) · US acute ALOS (AHA)</p>
          </Panel>
        )}

        <Panel title="Top 10 diagnoses" description={`${region === "us" ? "Principal" : "Primary"} diagnosis, all settings · ${REGIONS[region].dxSystem}`} className={inpatientOn ? undefined : "xl:col-span-3"}>
          {topDx.length === 0 ? (
            <p className="text-sm text-muted">No data yet.</p>
          ) : (
            <ol className="space-y-2.5">
              {topDx.map((d) => (
                <li key={d.code}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">
                      <span className="num text-[11px] text-muted">{dxLabel} </span>
                      <b className="num">{d.code}</b> {d.display}
                    </span>
                    <span className="num font-semibold">{d.n}</span>
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
          {ok ? "In range" : "Out of range"}
        </Chip>
      </div>
      <div className="num mt-1 text-xl font-bold">{value}</div>
      <div className="text-xs text-muted">Target {ideal}</div>
    </div>
  )
}
