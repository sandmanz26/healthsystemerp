/**
 * Bed board. The single most-watched screen in an inpatient unit: who is where, which beds
 * are free or being cleaned, and who is waiting in the ER for a bed.
 */
import { Button, Dropdown, Label } from "@heroui/react"
import { BedDouble, BedSingle, Clock, MoreVertical, Plus, Sparkles } from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { MarkerDots } from "@/components/clinical/wristband"
import { BedStatusChip, PayerChip } from "@/components/status"
import { Empty } from "@/components/ui/empty"
import { Page, PageHeader } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import { Segmented } from "@/components/ui/segmented"
import { Stat } from "@/components/ui/stat"
import { ageLabel, minutesSince, news2 } from "@/domain/clinical"
import type { Bed, BedStatus, Encounter } from "@/domain/types"
import { News2Chip } from "@/features/emr/clinical-widgets"
import { cn } from "@/lib/cn"
import { formatDuration, formatPercent } from "@/lib/format"
import { usePrefs } from "@/lib/prefs"
import { toast } from "@/lib/toast"
import { useActions, useStore } from "@/store"
import { usePatientMap, useStaffMap, useUnitName } from "@/store/selectors"
import { AdmitDialog, TransferDialog } from "./admit-dialog"

export default function InpatientPage() {
  const beds = useStore((s) => s.beds)
  const units = useStore((s) => s.units)
  const encounters = useStore((s) => s.encounters)
  const unitName = useUnitName()
  const navigate = useNavigate()
  const savedWard = usePrefs((s) => s.unitFilter.inpatient) ?? "all"
  const setUnitFilter = usePrefs((s) => s.setUnitFilter)
  const [admitting, setAdmitting] = useState<{ request?: Encounter; bedId?: string } | null>(null)
  const [transferring, setTransferring] = useState<Encounter>()

  const wards = units.filter((u) => u.kind === "ward" || u.kind === "icu")
  const encById = useMemo(() => new Map(encounters.map((e) => [e.id, e])), [encounters])
  const requests = encounters.filter((e) => e.status === "awaiting-admission")
  const visible = beds.filter((b) => savedWard === "all" || b.unitId === savedWard)
  const occupied = beds.filter((b) => b.status === "occupied").length
  const count = (s: BedStatus) => beds.filter((b) => b.status === s).length

  return (
    <Page>
      <PageHeader
        title="Rawat Inap"
        description="Bed board seluruh ruangan. Klik tempat tidur terisi untuk membuka rekam medis pasien."
        actions={
          <Button variant="primary" onPress={() => setAdmitting({})}>
            <Plus className="size-4" aria-hidden /> Admisi terencana
          </Button>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="BOR saat ini" value={formatPercent((occupied / beds.length) * 100)} hint={`${occupied} dari ${beds.length} TT`} icon={BedDouble} tone="accent" />
        <Stat label="Kosong siap pakai" value={count("available")} icon={BedSingle} tone="success" />
        <Stat label="Sedang dibersihkan" value={count("cleaning")} icon={Sparkles} tone={count("cleaning") ? "warning" : "default"} />
        <Stat label="Menunggu kamar" value={requests.length} icon={Clock} tone={requests.length ? "danger" : "default"} />
        <Stat label="Perbaikan / dipesan" value={count("maintenance") + count("reserved")} />
      </div>

      {requests.length > 0 && (
        <Panel title="Permintaan rawat inap" description="Pasien IGD/poli yang menunggu tempat tidur" className="mb-6" flush>
          <ul className="divide-y divide-separator">
            {requests.map((r) => (
              <RequestRow key={r.id} encounter={r} onAdmit={() => setAdmitting({ request: r })} />
            ))}
          </ul>
        </Panel>
      )}

      <div className="mb-4">
        <Segmented
          label="Ruangan"
          value={savedWard}
          onChange={(v) => setUnitFilter("inpatient", v)}
          options={[{ value: "all", label: "Semua", count: beds.length }, ...wards.map((w) => ({ value: w.id, label: w.name.replace(/ \(.*\)/, ""), count: beds.filter((b) => b.unitId === w.id && b.status === "occupied").length }))]}
        />
      </div>

      {wards
        .filter((w) => savedWard === "all" || w.id === savedWard)
        .map((w) => {
          const wardBeds = visible.filter((b) => b.unitId === w.id)
          return (
            <section key={w.id} className="mb-8">
              <h2 className="mb-3 flex items-baseline gap-2 text-sm font-semibold">
                {unitName(w.id)}
                <span className="tabular text-xs font-normal text-muted">
                  {wardBeds.filter((b) => b.status === "occupied").length}/{wardBeds.length} terisi
                </span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {wardBeds.map((b) => (
                  <BedCard
                    key={b.id}
                    bed={b}
                    encounter={b.encounterId ? encById.get(b.encounterId) : undefined}
                    onOpen={(e) => navigate(`/encounters/${e.id}`)}
                    onTransfer={setTransferring}
                    onAdmit={() => setAdmitting({ bedId: b.id, request: requests[0] })}
                  />
                ))}
              </div>
            </section>
          )
        })}
      {visible.length === 0 && <Empty title="Tidak ada tempat tidur" />}

      {admitting && <AdmitDialog request={admitting.request} bedId={admitting.bedId} onClose={() => setAdmitting(null)} />}
      {transferring && <TransferDialog encounter={transferring} onClose={() => setTransferring(undefined)} />}
    </Page>
  )
}

function RequestRow({ encounter, onAdmit }: { encounter: Encounter; onAdmit: () => void }) {
  const patient = useStore((s) => s.patients.find((p) => p.id === encounter.patientId))!
  const unitName = useUnitName()
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium">
          {patient.name} <span className="text-sm font-normal text-muted">· {ageLabel(patient.birthDate)} · dari {unitName(encounter.unitId)}</span>
        </div>
        <div className="text-sm text-muted">
          {encounter.diagnoses.find((d) => d.primary)?.display ?? encounter.chiefComplaint}
          {encounter.dispositionNote && ` — ${encounter.dispositionNote}`}
        </div>
      </div>
      <span className="tabular text-sm font-semibold text-danger">menunggu {formatDuration(minutesSince(encounter.endedAt ?? encounter.startedAt ?? encounter.createdAt))}</span>
      <PayerChip payer={encounter.payer} />
      <Button size="sm" variant="primary" onPress={onAdmit}>
        Pilih tempat tidur
      </Button>
    </li>
  )
}

interface BedCardProps {
  bed: Bed
  encounter?: Encounter
  onOpen: (e: Encounter) => void
  onTransfer: (e: Encounter) => void
  onAdmit: () => void
}

const BLANKET: Record<BedStatus, string> = {
  occupied: "bg-accent-soft text-foreground",
  available: "border-2 border-dashed border-success/50 text-success",
  cleaning: "bg-hatch text-warning/40",
  maintenance: "bg-hatch text-danger/35",
  reserved: "border-2 border-dotted border-border text-muted",
}

/**
 * One bed drawn from above: headboard, pillow, blanket. The blanket carries the patient;
 * its fill is the bed status (hatching = not usable right now).
 */
function BedCard({ bed, encounter, onOpen, onTransfer, onAdmit }: BedCardProps) {
  const patients = usePatientMap()
  const staff = useStaffMap()
  const { setBedStatus } = useActions()
  const patient = encounter ? patients.get(encounter.patientId) : undefined
  const latest = encounter ? [...encounter.vitals].sort((a, b) => b.at.localeCompare(a.at))[0] : undefined
  const los = encounter ? Math.max(1, Math.ceil(minutesSince(encounter.startedAt ?? encounter.createdAt) / 1440)) : 0
  const score = latest ? news2(latest) : null
  const alarm = score && score.risk !== "rendah"

  return (
    <article className={cn("rounded-[14px] border bg-surface p-3", alarm ? (score.risk === "tinggi" ? "border-danger" : "border-warning") : "border-border")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="num text-sm font-bold">{bed.code}</span>
          <span className="label-caps text-muted">{bed.bedClass}</span>
        </div>
        <div className="flex items-center gap-1">
          <BedStatusChip status={bed.status} />
          <Dropdown>
            <Dropdown.Trigger aria-label={`Aksi ${bed.code}`} className="grid size-7 place-items-center rounded-lg hover:bg-surface-secondary">
              <MoreVertical className="size-4" />
            </Dropdown.Trigger>
            <Dropdown.Popover placement="bottom end">
              <Dropdown.Menu
                aria-label="Aksi tempat tidur"
                onAction={(key) => {
                  if (key === "open" && encounter) onOpen(encounter)
                  else if (key === "transfer" && encounter) onTransfer(encounter)
                  else if (key === "admit") onAdmit()
                  else {
                    setBedStatus(bed.id, key as BedStatus)
                    toast(`${bed.code}: status diperbarui`)
                  }
                }}
              >
                {encounter ? (
                  <>
                    <Dropdown.Item id="open" textValue="Buka rekam medis"><Label>Buka rekam medis</Label></Dropdown.Item>
                    <Dropdown.Item id="transfer" textValue="Pindah ruang"><Label>Pindah ruang</Label></Dropdown.Item>
                  </>
                ) : (
                  <>
                    {bed.status === "available" && <Dropdown.Item id="admit" textValue="Admisi ke sini"><Label>Admisi ke sini</Label></Dropdown.Item>}
                    {bed.status !== "available" && <Dropdown.Item id="available" textValue="Siap pakai"><Label>Tandai siap pakai</Label></Dropdown.Item>}
                    {bed.status !== "cleaning" && <Dropdown.Item id="cleaning" textValue="Dibersihkan"><Label>Tandai perlu dibersihkan</Label></Dropdown.Item>}
                    {bed.status !== "reserved" && <Dropdown.Item id="reserved" textValue="Dipesan"><Label>Tandai dipesan</Label></Dropdown.Item>}
                    {bed.status !== "maintenance" && <Dropdown.Item id="maintenance" textValue="Perbaikan"><Label>Tandai perbaikan</Label></Dropdown.Item>}
                  </>
                )}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>
      </div>

      {/* The bed, from above */}
      <div className="flex h-[104px] items-stretch gap-1.5 rounded-xl border border-border bg-surface-secondary p-1.5">
        <div className="w-1.5 shrink-0 rounded-full bg-surface-tertiary" aria-hidden />
        <div className="flex w-7 shrink-0 items-center" aria-hidden>
          <div className="h-3/5 w-full rounded-md border border-border bg-surface" />
        </div>
        {encounter && patient ? (
          <button type="button" onClick={() => onOpen(encounter)} className={cn("min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-left transition hover:brightness-[0.97]", BLANKET.occupied)}>
            <div className="flex items-center gap-1.5">
              <span className="truncate font-semibold">{patient.name}</span>
              <MarkerDots patient={patient} />
            </div>
            <div className="num truncate text-[11px] text-muted">
              {patient.gender === "female" ? "P" : "L"} · {ageLabel(patient.birthDate)} · hari ke-{los}
            </div>
            <div className="mt-0.5 line-clamp-1 text-xs">{encounter.diagnoses.find((d) => d.primary)?.display ?? encounter.chiefComplaint}</div>
            <div className="mt-1 flex items-center gap-1.5">
              <News2Chip vitals={latest} />
              <span className="truncate text-[11px] text-muted">{staff.get(encounter.practitionerId ?? "")?.name.replace(/,.*$/, "")}</span>
            </div>
          </button>
        ) : (
          <div className={cn("flex min-w-0 flex-1 items-center justify-center rounded-lg text-center", BLANKET[bed.status])}>
            {bed.status === "available" ? (
              <button type="button" onClick={onAdmit} className="label-caps h-full w-full rounded-lg hover:bg-success/10">
                Kosong · admisi
              </button>
            ) : (
              <span className="label-caps rounded bg-surface px-2 py-1 text-muted">{bed.status === "cleaning" ? "Housekeeping" : bed.status === "reserved" ? "Dipesan" : "Perbaikan"}</span>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
