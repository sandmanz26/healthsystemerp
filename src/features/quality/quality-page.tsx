/**
 * Patient safety & quality: incident reporting (IKP) with automatic risk grading, and the
 * 13 national quality indicators (INM) against target.
 */
import { Button, Chip, Switch, Tabs } from "@heroui/react"
import { CheckCircle2, ShieldAlert, Siren, Target, XCircle } from "lucide-react"
import { useState } from "react"
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { axisProps, gridProps, SERIES } from "@/components/chart-theme"
import { ChartTooltip } from "@/components/charts"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Dialog } from "@/components/ui/dialog"
import { Empty } from "@/components/ui/empty"
import { SelectInput, TextAreaInput, TextInput } from "@/components/ui/fields"
import { Page, PageHeader } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import { Stat } from "@/components/ui/stat"
import { GRADE_INFO, IMPACT_LABEL, INCIDENT_TYPES, INM, PROBABILITY_LABEL, indicatorRate, meetsTarget, riskGrade } from "@/domain/quality"
import type { Incident, IncidentType } from "@/domain/types"
import { cn } from "@/lib/cn"
import { formatDate, formatNumber, formatPercent } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useNow } from "@/lib/use-now"
import { useActions, useStore } from "@/store"
import { useSession, useStaffMap, useUnitName } from "@/store/selectors"

const STATUS_LABEL: Record<Incident["status"], string> = { dilaporkan: "Dilaporkan", investigasi: "Investigasi", selesai: "Selesai" }
const MONTH = new Intl.DateTimeFormat("id-ID", { month: "short", year: "2-digit" })
const periodLabel = (p: string) => MONTH.format(new Date(`${p}-01T00:00:00`))

export default function QualityPage() {
  const incidents = useStore((s) => s.incidents)
  const indicators = useStore((s) => s.indicators)
  const unitName = useUnitName()
  const staff = useStaffMap()
  const { role } = useSession()
  const { setIncidentStatus } = useActions()
  const [reporting, setReporting] = useState(false)
  const [indicatorId, setIndicatorId] = useState(INM[4].id)
  const now = useNow(60_000)

  const periods = [...new Set(indicators.map((i) => i.period))].sort()
  const latest = periods[periods.length - 1]
  const latestRates = INM.map((def) => {
    const v = indicators.find((i) => i.indicatorId === def.id && i.period === latest)
    const rate = v ? indicatorRate(v) : 0
    return { def, rate, ok: meetsTarget(def, rate), v }
  })
  const series = periods.map((p) => {
    const v = indicators.find((i) => i.indicatorId === indicatorId && i.period === p)
    return { period: periodLabel(p), rate: v ? Math.round(indicatorRate(v) * 10) / 10 : null }
  })
  const selectedDef = INM.find((d) => d.id === indicatorId)!
  const openHigh = incidents.filter((i) => i.status !== "selesai" && (i.grade === "merah" || i.grade === "kuning"))
  const thisMonth = incidents.filter((i) => new Date(i.at).getMonth() === new Date().getMonth())

  const columns: Column<Incident>[] = [
    { id: "date", header: "Tanggal", sortValue: (i) => i.at, cell: (i) => <span className="tabular text-sm">{formatDate(i.at)}</span> },
    { id: "type", header: "Jenis", cell: (i) => <Chip size="sm" variant={i.type === "Sentinel" ? "primary" : "soft"} color={i.type === "Sentinel" || i.type === "KTD" ? "danger" : "default"}>{i.type}</Chip> },
    { id: "unit", header: "Unit", cell: (i) => <span className="text-sm">{unitName(i.unitId)}</span> },
    { id: "desc", header: "Kronologi", isRowHeader: true, cell: (i) => <span className="line-clamp-2 text-sm">{i.description}</span> },
    { id: "grade", header: "Grading", sortValue: (i) => ["biru", "hijau", "kuning", "merah"].indexOf(i.grade), cell: (i) => <Chip size="sm" variant="soft" color={GRADE_INFO[i.grade].color}>{GRADE_INFO[i.grade].label}</Chip> },
    { id: "reporter", header: "Pelapor", cell: (i) => <span className="text-sm text-muted">{i.reportedBy ? staff.get(i.reportedBy)?.name : "Anonim"}</span> },
    {
      id: "status",
      header: "Status",
      cell: (i) =>
        role === "manager" || role === "admin" ? (
          <SelectInput label="Status" className="w-36" value={i.status} onChange={(s) => setIncidentStatus(i.id, s)} options={(Object.keys(STATUS_LABEL) as Incident["status"][]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
        ) : (
          <Chip size="sm" variant="soft">{STATUS_LABEL[i.status]}</Chip>
        ),
    },
  ]

  return (
    <Page>
      <PageHeader
        title="Mutu & Keselamatan Pasien"
        description="Laporkan insiden tanpa takut — pelaporan boleh anonim. Tujuannya belajar dari sistem, bukan mencari siapa yang salah."
        actions={
          <Button variant="primary" onPress={() => setReporting(true)}>
            <ShieldAlert className="size-4" aria-hidden /> Laporkan insiden
          </Button>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Insiden bulan ini" value={thisMonth.length} icon={ShieldAlert} />
        <Stat label="Grade kuning/merah belum selesai" value={openHigh.length} icon={Siren} tone={openHigh.length ? "danger" : "success"} />
        <Stat label={`INM tercapai (${latest ? periodLabel(latest) : "-"})`} value={`${latestRates.filter((r) => r.ok).length}/${INM.length}`} icon={Target} tone="accent" />
        <Stat label="Sentinel 90 hari" value={incidents.filter((i) => i.type === "Sentinel" && now - new Date(i.at).getTime() < 90 * 86400000).length} tone="danger" />
      </div>

      <Tabs>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Mutu">
            <Tabs.Tab id="ikp">Insiden keselamatan pasien<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab id="inm">Indikator Mutu Nasional<Tabs.Indicator /></Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="ikp" className="pt-4">
          <Panel flush>
            <DataTable label="Insiden" rows={incidents} columns={columns} rowKey={(i) => i.id} defaultSort={{ column: "date", direction: "descending" }} empty={<Empty title="Belum ada laporan insiden" />} />
          </Panel>
        </Tabs.Panel>
        <Tabs.Panel id="inm" className="space-y-4 pt-4">
          <Panel title={selectedDef.name} description={`Target ${selectedDef.direction === "min" ? "≥" : "≤"} ${formatPercent(selectedDef.target)} · 6 bulan terakhir`}>
            <div className="h-64" role="img" aria-label={`Tren ${selectedDef.name}`}>
              <ResponsiveContainer>
                <LineChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="period" {...axisProps} />
                  <YAxis {...axisProps} domain={[0, 100]} unit="%" />
                  <ReferenceLine y={selectedDef.target} stroke="var(--muted)" strokeDasharray="4 4" label={{ value: "Target", position: "insideTopRight", fill: "var(--muted)", fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip format={(v) => formatPercent(v)} />} cursor={{ stroke: "var(--chart-grid)" }} />
                  <Line type="monotone" dataKey="rate" name="Capaian" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "var(--surface)" }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title={`Capaian ${latest ? periodLabel(latest) : ""}`} description="Klik indikator untuk melihat trennya." flush>
            <ul className="divide-y divide-separator">
              {latestRates.map(({ def, rate, ok, v }) => (
                <li key={def.id}>
                  <button type="button" onClick={() => setIndicatorId(def.id)} className={cn("flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-secondary", def.id === indicatorId && "bg-accent-soft/50")}>
                    {ok ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Tercapai" /> : <XCircle className="size-4 shrink-0 text-danger" aria-label="Belum tercapai" />}
                    <span className="flex-1 text-sm">{def.name}</span>
                    <span className="tabular text-xs text-muted">
                      {v ? `${formatNumber(v.numerator)}/${formatNumber(v.denominator)}` : "—"}
                    </span>
                    <span className={cn("tabular w-16 text-right text-sm font-semibold", !ok && "text-danger")}>{formatPercent(rate)}</span>
                    <span className="tabular w-16 text-right text-xs text-muted">
                      {def.direction === "min" ? "≥" : "≤"} {def.target}%
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

function ReportDialog({ onClose }: { onClose: () => void }) {
  const units = useStore((s) => s.units)
  const { user } = useSession()
  const { reportIncident } = useActions()
  const [type, setType] = useState<IncidentType | null>(null)
  const [unitId, setUnitId] = useState<string | null>(user?.unitId ?? null)
  const [when, setWhen] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16))
  const [description, setDescription] = useState("")
  const [action, setAction] = useState("")
  const [impact, setImpact] = useState("2")
  const [probability, setProbability] = useState("2")
  const [anonymous, setAnonymous] = useState(false)
  const grade = riskGrade(Number(probability), Number(impact))
  const valid = type && unitId && description.trim().length >= 10

  return (
    <Dialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      isDismissable={false}
      size="lg"
      title="Laporan insiden keselamatan pasien"
      description="Wajib dilaporkan ≤ 2 × 24 jam setelah insiden. Tulis kronologi apa adanya."
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            isDisabled={!valid}
            onPress={() => {
              reportIncident({ type: type!, unitId: unitId!, at: new Date(when).toISOString(), description: description.trim(), immediateAction: action.trim(), impact: Number(impact) as Incident["impact"], probability: Number(probability) as Incident["probability"], reportedBy: anonymous ? undefined : user?.id })
              toast.success("Laporan terkirim ke tim KPRS", { description: GRADE_INFO[grade].action })
              onClose()
            }}
          >
            Kirim laporan
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput label="Jenis insiden" value={type} onChange={setType} isRequired options={(Object.keys(INCIDENT_TYPES) as IncidentType[]).map((t) => ({ value: t, label: t, description: INCIDENT_TYPES[t] }))} />
        <SelectInput label="Unit kejadian" value={unitId} onChange={setUnitId} isRequired options={units.map((u) => ({ value: u.id, label: u.name }))} />
        <TextInput label="Waktu kejadian" type="text" value={when.replace("T", " ")} onChange={(v) => setWhen(v.replace(" ", "T"))} description="yyyy-mm-dd hh:mm" />
        <Switch isSelected={anonymous} onChange={setAnonymous} className="self-end pb-2">
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <span className="text-sm">Laporkan secara anonim</span>
          </Switch.Content>
        </Switch>
      </div>
      <TextAreaInput label="Kronologi" value={description} onChange={setDescription} rows={3} isRequired description="Apa yang terjadi, kapan, di mana. Tanpa menyebut nama pihak yang terlibat." />
      <TextAreaInput label="Tindakan segera yang dilakukan" value={action} onChange={setAction} rows={2} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput label="Dampak" value={impact} onChange={setImpact} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} — ${IMPACT_LABEL[n]}` }))} />
        <SelectInput label="Probabilitas berulang" value={probability} onChange={setProbability} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} — ${PROBABILITY_LABEL[n]}` }))} />
      </div>
      <div className={cn("rounded-xl p-3 text-sm", grade === "merah" ? "bg-danger-soft text-danger-soft-foreground" : grade === "kuning" ? "bg-warning-soft text-warning-soft-foreground" : grade === "hijau" ? "bg-success-soft text-success-soft-foreground" : "bg-accent-soft text-accent-soft-foreground")} role="status">
        <b>Grading: {GRADE_INFO[grade].label}.</b> {GRADE_INFO[grade].action}.
      </div>
    </Dialog>
  )
}
