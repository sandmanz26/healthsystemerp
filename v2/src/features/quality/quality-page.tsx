/**
 * Patient safety & quality: incident reporting with a 5×5 risk matrix and the external
 * reporting route each harm level triggers (AHRQ Common Formats / PSO / Joint Commission in
 * the US; LFPSE / PSIRF / Duty of Candour in England), plus the measures each market reports.
 */
import { Button, Chip, Switch, Tabs } from "@heroui/react"
import { CheckCircle2, Megaphone, ShieldAlert, Siren, Target, XCircle } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { axisProps, gridProps, SERIES } from "@v2/components/chart-theme"
import { ChartTooltip } from "@v2/components/charts"
import { DataTable, type Column } from "@v2/components/ui/data-table"
import { Dialog } from "@v2/components/ui/dialog"
import { Empty } from "@v2/components/ui/empty"
import { SelectInput, TextAreaInput, TextInput } from "@v2/components/ui/fields"
import { Page, PageHeader } from "@v2/components/ui/page"
import { Panel } from "@v2/components/ui/panel"
import { Stat } from "@v2/components/ui/stat"
import { CATEGORY_LABEL, GRADE_INFO, HARM_LABEL, IMPACT_LABEL, MEASURES, PROBABILITY_LABEL, externalReporting, indicatorRate, meetsTarget, riskGrade, type IndicatorDef } from "@v2/domain/quality"
import { REGIONS, type Region } from "@v2/domain/region"
import type { HarmLevel, Incident, IncidentCategory, RiskGrade } from "@v2/domain/types"
import { cn } from "@v2/lib/cn"
import { formatDate, formatNumber } from "@v2/lib/format"
import { toast } from "@v2/lib/toast"
import { useNow } from "@v2/lib/use-now"
import { useActions, useStore } from "@v2/store"
import { useRegion, useSession, useStaffMap, useUnitName } from "@v2/store/selectors"

const STATUS_LABEL: Record<Incident["status"], string> = { reported: "Reported", "under-review": "Under review", closed: "Closed" }
const GRADE_ORDER: RiskGrade[] = ["low", "moderate", "high", "extreme"]
const GRADE_CELL: Record<RiskGrade, string> = {
  low: "bg-success-soft text-success-soft-foreground",
  moderate: "bg-accent-soft text-accent-soft-foreground",
  high: "bg-warning-soft text-warning-soft-foreground",
  extreme: "bg-danger-soft text-danger-soft-foreground",
}
const HARM_COLOR: Record<HarmLevel, "default" | "accent" | "warning" | "danger"> = { "near-miss": "default", none: "default", low: "accent", moderate: "warning", severe: "danger", death: "danger" }

const sentinelLabel = (region: Region) => (region === "us" ? "Sentinel event" : "Never Event")
const formatRate = (rate: number, unit: IndicatorDef["unit"]) => (unit === "%" ? `${formatNumber(rate)}%` : `${formatNumber(rate)} ‰`)
const unitCaption = (unit: IndicatorDef["unit"]) => (unit === "%" ? "%" : "per 1,000")

export default function QualityPage() {
  const incidents = useStore((s) => s.incidents)
  const indicators = useStore((s) => s.indicators)
  const unitName = useUnitName()
  const staff = useStaffMap()
  const region = useRegion()
  const { role } = useSession()
  const { setIncidentStatus } = useActions()
  const [reporting, setReporting] = useState(false)
  const measures = MEASURES[region]
  const [indicatorId, setIndicatorId] = useState(measures[0].id)
  const now = useNow(60_000)
  const monthFmt = useMemo(() => new Intl.DateTimeFormat(REGIONS[region].locale, { month: "short", year: "2-digit" }), [region])
  const periodLabel = (p: string) => monthFmt.format(new Date(`${p}-01T00:00:00`))

  const periods = [...new Set(indicators.map((i) => i.period))].sort()
  const latest = periods[periods.length - 1]
  const latestRates = measures.map((def) => {
    const v = indicators.find((i) => i.indicatorId === def.id && i.period === latest)
    const rate = v ? indicatorRate(v, def.unit) : 0
    return { def, rate, ok: v ? meetsTarget(def, rate) : false, v }
  })
  const selectedDef = measures.find((d) => d.id === indicatorId) ?? measures[0]
  const series = periods.map((p) => {
    const v = indicators.find((i) => i.indicatorId === selectedDef.id && i.period === p)
    return { period: periodLabel(p), rate: v ? Math.round(indicatorRate(v, selectedDef.unit) * 10) / 10 : null }
  })
  const openHigh = incidents.filter((i) => i.status !== "closed" && (i.grade === "high" || i.grade === "extreme"))
  const thisMonth = incidents.filter((i) => new Date(i.at).getMonth() === new Date(now).getMonth() && new Date(i.at).getFullYear() === new Date(now).getFullYear())

  const columns: Column<Incident>[] = [
    { id: "date", header: "Date", sortValue: (i) => i.at, cell: (i) => <span className="num text-sm">{formatDate(i.at)}</span> },
    {
      id: "category",
      header: "Category",
      cell: (i) => (
        <div className="space-y-0.5">
          <div className="text-sm">{CATEGORY_LABEL[i.category]}</div>
          {i.sentinel && (
            <Chip size="sm" color="danger" variant="primary">
              {sentinelLabel(region)}
            </Chip>
          )}
        </div>
      ),
    },
    {
      id: "harm",
      header: "Harm",
      sortValue: (i) => ["near-miss", "none", "low", "moderate", "severe", "death"].indexOf(i.harm),
      cell: (i) => (
        <Chip size="sm" variant="soft" color={HARM_COLOR[i.harm]} className="whitespace-nowrap">
          {i.harm === "near-miss" ? "Near miss" : HARM_LABEL[i.harm]}
        </Chip>
      ),
    },
    { id: "unit", header: "Unit", cell: (i) => <span className="text-sm">{unitName(i.unitId)}</span> },
    { id: "desc", header: "What happened", isRowHeader: true, cell: (i) => <span className="line-clamp-2 text-sm">{i.description}</span> },
    {
      id: "grade",
      header: "Risk",
      sortValue: (i) => GRADE_ORDER.indexOf(i.grade),
      cell: (i) => (
        <div className="space-y-0.5">
          <Chip size="sm" variant="soft" color={GRADE_INFO[i.grade].color} className="whitespace-nowrap">
            {GRADE_INFO[i.grade].label}
          </Chip>
          <div className="num text-xs text-muted">
            C{i.impact} × L{i.probability} = {i.impact * i.probability}
          </div>
        </div>
      ),
    },
    { id: "reporter", header: "Reporter", cell: (i) => <span className="text-sm text-muted">{i.reportedBy ? staff.get(i.reportedBy)?.name : "Anonymous"}</span> },
    {
      id: "status",
      header: "Status",
      cell: (i) =>
        role === "manager" || role === "admin" ? (
          <SelectInput label="Status" className="w-36" value={i.status} onChange={(s) => setIncidentStatus(i.id, s)} options={(Object.keys(STATUS_LABEL) as Incident["status"][]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
        ) : (
          <Chip size="sm" variant="soft">
            {STATUS_LABEL[i.status]}
          </Chip>
        ),
    },
  ]

  return (
    <Page>
      <PageHeader
        title="Quality & Patient Safety"
        description={
          region === "us"
            ? "Report safety events without fear — anonymous reports are welcome. Reports feed our Patient Safety Organization under the Patient Safety Act (privileged & confidential)."
            : "Report incidents without fear — anonymous reports are welcome. We learn from systems, not blame individuals (PSIRF; Just Culture)."
        }
        actions={
          <Button variant="primary" onPress={() => setReporting(true)}>
            <ShieldAlert className="size-4" aria-hidden /> Report {region === "us" ? "safety event" : "incident"}
          </Button>
        }
      />
      <div className="stat-strip mb-6 grid grid-cols-2 lg:grid-cols-4">
        <Stat label="Reports this month" value={thisMonth.length} icon={ShieldAlert} hint={`${thisMonth.filter((i) => i.harm === "near-miss").length} near misses`} />
        <Stat label="High / extreme risk open" value={openHigh.length} icon={Siren} tone={openHigh.length ? "danger" : "success"} />
        <Stat label={`Measures on target (${latest ? periodLabel(latest) : "—"})`} value={`${latestRates.filter((r) => r.ok).length}/${measures.length}`} icon={Target} tone="accent" />
        <Stat label={`${region === "us" ? "Sentinel events" : "Never Events"} · 90 days`} value={incidents.filter((i) => i.sentinel && now - new Date(i.at).getTime() < 90 * 86400000).length} tone="danger" />
      </div>

      <Tabs>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Quality">
            <Tabs.Tab id="incidents">
              {region === "us" ? "Safety events" : "Incidents"}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="measures">
              {region === "us" ? "Quality measures" : "Quality indicators"}
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="incidents" className="pt-4">
          <Panel flush>
            <DataTable label="Incident reports" rows={incidents} columns={columns} rowKey={(i) => i.id} minWidth={1060} defaultSort={{ column: "date", direction: "descending" }} empty={<Empty title="No reports yet" />} />
          </Panel>
        </Tabs.Panel>
        <Tabs.Panel id="measures" className="space-y-4 pt-4">
          <Panel
            title={selectedDef.name}
            description={
              <>
                Target {selectedDef.direction === "min" ? "≥" : "≤"} {formatRate(selectedDef.target, selectedDef.unit)} · last {periods.length} months
                <span className="label-caps ml-2">Source: {selectedDef.source}</span>
              </>
            }
          >
            <div className="h-64" role="img" aria-label={`Trend: ${selectedDef.name}`}>
              <ResponsiveContainer>
                <LineChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="period" {...axisProps} />
                  <YAxis {...axisProps} domain={selectedDef.unit === "%" ? [0, 100] : [0, "auto"]} unit={selectedDef.unit === "%" ? "%" : ""} />
                  <ReferenceLine y={selectedDef.target} stroke="var(--muted)" strokeDasharray="4 4" label={{ value: "Target", position: "insideTopRight", fill: "var(--muted)", fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip format={(v) => formatRate(v, selectedDef.unit)} />} cursor={{ stroke: "var(--chart-grid)" }} />
                  <Line type="monotone" dataKey="rate" name="Performance" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "var(--surface)" }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title={`Performance ${latest ? periodLabel(latest) : ""}`} description="Select a measure to see its trend." flush>
            <ul className="divide-y divide-separator">
              {latestRates.map(({ def, rate, ok, v }) => (
                <li key={def.id}>
                  <button type="button" onClick={() => setIndicatorId(def.id)} className={cn("flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-secondary", def.id === selectedDef.id && "bg-accent-soft/50")}>
                    {ok ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="On target" /> : <XCircle className="size-4 shrink-0 text-danger" aria-label="Below target" />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">{def.name}</span>
                      <span className="label-caps text-muted">Source: {def.source}</span>
                    </span>
                    <span className="num hidden text-xs text-muted sm:inline">{v ? `${formatNumber(v.numerator)}/${formatNumber(v.denominator)}` : "—"}</span>
                    <span className={cn("num w-20 text-right text-sm font-semibold", !ok && "text-danger")}>{formatRate(rate, def.unit)}</span>
                    <span className="num w-24 text-right text-xs text-muted">
                      {def.direction === "min" ? "≥" : "≤"} {def.target} {unitCaption(def.unit)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </Tabs.Panel>
      </Tabs>
      {reporting && <ReportDialog onClose={() => setReporting(false)} />}
    </Page>
  )
}

/** 5×5 consequence × likelihood matrix; click a cell to rate the incident. */
function RiskMatrix({ impact, probability, onChange }: { impact: number; probability: number; onChange: (impact: number, probability: number) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[440px] border-separate border-spacing-1 text-center text-xs">
        <thead>
          <tr>
            <th className="label-caps w-28 text-left text-muted">Likelihood ↓</th>
            {[1, 2, 3, 4, 5].map((c) => (
              <th key={c} className="font-medium text-muted">
                <div className="num">C{c}</div>
                <div className="text-xs">{IMPACT_LABEL[c]}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[5, 4, 3, 2, 1].map((l) => (
            <tr key={l}>
              <th className="text-left font-medium text-muted">
                <span className="num">L{l}</span> <span className="text-xs">{PROBABILITY_LABEL[l]}</span>
              </th>
              {[1, 2, 3, 4, 5].map((c) => {
                const g = riskGrade(l, c)
                const on = c === impact && l === probability
                return (
                  <td key={c}>
                    <button
                      type="button"
                      aria-label={`Consequence ${c} ${IMPACT_LABEL[c]}, likelihood ${l} ${PROBABILITY_LABEL[l]}: score ${c * l}`}
                      aria-pressed={on}
                      onClick={() => onChange(c, l)}
                      className={cn("num h-8 w-full rounded-md font-semibold transition", GRADE_CELL[g], on ? "ring-2 ring-foreground ring-offset-1 ring-offset-surface" : "opacity-70 hover:opacity-100")}
                    >
                      {c * l}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="label-caps mt-1 text-muted">Consequence → · NPSA 5×5 risk matrix</div>
    </div>
  )
}

function ToggleRow({ isSelected, onChange, children }: { isSelected: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <Switch isSelected={isSelected} onChange={onChange}>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <span className="text-sm">{children}</span>
      </Switch.Content>
    </Switch>
  )
}

function ReportDialog({ onClose }: { onClose: () => void }) {
  const units = useStore((s) => s.units)
  const region = useRegion()
  const { user } = useSession()
  const { reportIncident } = useActions()
  const [category, setCategory] = useState<IncidentCategory | null>(null)
  const [harm, setHarm] = useState<HarmLevel>("none")
  const [nearMiss, setNearMiss] = useState(false)
  const [sentinel, setSentinel] = useState(false)
  const [unitId, setUnitId] = useState<string | null>(user?.unitId ?? null)
  const [when, setWhen] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16))
  const [description, setDescription] = useState("")
  const [action, setAction] = useState("")
  const [impact, setImpact] = useState(2)
  const [probability, setProbability] = useState(2)
  const [anonymous, setAnonymous] = useState(false)
  const grade = riskGrade(probability, impact)
  const effectiveHarm: HarmLevel = nearMiss ? "near-miss" : harm
  const valid = category && unitId && description.trim().length >= 10 && !Number.isNaN(new Date(when).getTime())
  const harmOptions = (Object.keys(HARM_LABEL) as HarmLevel[]).filter((h) => h !== "near-miss")

  return (
    <Dialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      isDismissable={false}
      size="lg"
      title={region === "us" ? "Patient safety event report" : "Patient safety incident report"}
      description={region === "us" ? "Report within 24 hours. Describe facts, not blame." : "Report as soon as possible and within 2 working days. Describe facts, not blame."}
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isDisabled={!valid}
            onPress={() => {
              reportIncident({
                category: category!,
                harm: effectiveHarm,
                sentinel: sentinel || undefined,
                unitId: unitId!,
                at: new Date(when).toISOString(),
                description: description.trim(),
                immediateAction: action.trim(),
                impact: impact as Incident["impact"],
                probability: probability as Incident["probability"],
                reportedBy: anonymous ? undefined : user?.id,
              })
              toast.success(region === "us" ? "Report sent to Patient Safety" : "Report sent to the Patient Safety team", { description: GRADE_INFO[grade].action })
              onClose()
            }}
          >
            Submit report
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput label="Event category" value={category} onChange={setCategory} isRequired options={(Object.keys(CATEGORY_LABEL) as IncidentCategory[]).map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))} />
        <SelectInput label="Where it happened" value={unitId} onChange={setUnitId} isRequired options={units.map((u) => ({ value: u.id, label: u.name }))} />
        <TextInput label="When it happened" value={when.replace("T", " ")} onChange={(v) => setWhen(v.replace(" ", "T"))} description="yyyy-mm-dd hh:mm" />
        <SelectInput label={region === "us" ? "Harm (AHRQ Common Formats)" : "Physical harm (LFPSE)"} value={nearMiss ? null : harm} isDisabled={nearMiss} placeholder="Near miss" onChange={setHarm} options={harmOptions.map((h) => ({ value: h, label: HARM_LABEL[h] }))} />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <ToggleRow isSelected={nearMiss} onChange={setNearMiss}>
          Near miss — did not reach the patient
        </ToggleRow>
        <ToggleRow isSelected={sentinel} onChange={setSentinel}>
          {region === "us" ? "Sentinel event (Joint Commission)" : "Never Event (NHS England list)"}
        </ToggleRow>
        <ToggleRow isSelected={anonymous} onChange={setAnonymous}>
          Report anonymously
        </ToggleRow>
      </div>
      <TextAreaInput label="What happened" value={description} onChange={setDescription} rows={3} isRequired description="What, when and where. Do not name the people involved." />
      <TextAreaInput label="Immediate action taken" value={action} onChange={setAction} rows={2} />
      <div>
        <div className="mb-2 text-sm font-medium">
          Risk rating: <span className="num">C{impact} × L{probability} = {impact * probability}</span>
        </div>
        <RiskMatrix impact={impact} probability={probability} onChange={(c, l) => { setImpact(c); setProbability(l) }} />
      </div>
      <div className={cn("rounded-lg p-3 text-sm", GRADE_CELL[grade])} role="status">
        <b>{GRADE_INFO[grade].label}.</b> {GRADE_INFO[grade].action}.
      </div>
      <div className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
        <Megaphone className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
        <div>
          <div className="font-medium">External reporting</div>
          <div>{externalReporting(region, effectiveHarm, sentinel)}</div>
          <div className="label-caps mt-1 text-muted">{region === "us" ? "AHRQ Common Formats · PSO · Joint Commission Sentinel Event Policy" : "LFPSE · PSIRF · CQC Regulation 20 Duty of Candour"}</div>
        </div>
      </div>
    </Dialog>
  )
}
