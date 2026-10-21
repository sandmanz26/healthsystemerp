/**
 * Bed board. The single most-watched screen in an inpatient unit: who is where, which beds
 * are free or being cleaned, and who is waiting in the ER for a bed.
 */
import { Button, Card, Dropdown, Label } from "@heroui/react"
import { AlertTriangle, BedDouble, BedSingle, Clock, MoreVertical, Plus, Sparkles } from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { BedStatusChip, PayerChip } from "@/components/status"
import { Empty } from "@/components/ui/empty"
import { Page, PageHeader } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import { Segmented } from "@/components/ui/segmented"
import { Stat } from "@/components/ui/stat"
import { ageLabel, minutesSince } from "@/domain/clinical"
import type { Bed, BedStatus, Encounter } from "@/domain/types"
import { News2Chip } from "@/features/emr/clinical-widgets"
import { cn } from "@/lib/cn"
import { formatDuration, formatPercent } from "@/lib/format"
import { usePrefs } from "@/lib/prefs"
import { toast } from "@/lib/toast"
import { useActions, useStore } from "@/store"
import { usePatientMap, useStaffMap, useUnitName } from "@/store/selectors"
import { AdmitDialog, TransferDialog } from "./admit-dialog"

const CARD_TONE: Record<BedStatus, string> = {
  occupied: "border-accent/30",
  available: "border-success/40 border-dashed",
  cleaning: "border-warning/50 border-dashed",
  maintenance: "border-danger/40 border-dashed opacity-70",
  reserved: "border-border border-dashed",
}

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

function BedCard({ bed, encounter, onOpen, onTransfer, onAdmit }: BedCardProps) {
  const patients = usePatientMap()
  const staff = useStaffMap()
  const { setBedStatus } = useActions()
  const patient = encounter ? patients.get(encounter.patientId) : undefined
  const latest = encounter ? [...encounter.vitals].sort((a, b) => b.at.localeCompare(a.at))[0] : undefined
  const los = encounter ? Math.max(1, Math.ceil(minutesSince(encounter.startedAt ?? encounter.createdAt) / 1440)) : 0

  return (
    <Card className={cn("gap-2 border-2 p-4", CARD_TONE[bed.status])}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="tabular font-bold">{bed.code}</span>
          <span className="rounded-md bg-surface-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted">{bed.bedClass}</span>
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
      {encounter && patient ? (
        <button type="button" onClick={() => onOpen(encounter)} className="text-left">
          <div className="flex items-center gap-1.5 font-semibold">
            {patient.name}
            {patient.allergies.length > 0 && <AlertTriangle className="size-3.5 text-danger" aria-label="Ada alergi" />}
          </div>
          <div className="tabular text-xs text-muted">
            {patient.gender === "female" ? "P" : "L"} · {ageLabel(patient.birthDate)} · RM {patient.mrn}
          </div>
          <div className="mt-1 line-clamp-1 text-sm">{encounter.diagnoses.find((d) => d.primary)?.display ?? encounter.chiefComplaint}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <News2Chip vitals={latest} />
            <span>Hari ke-{los}</span>
            <span>· {staff.get(encounter.practitionerId ?? "")?.name.replace(/,.*$/, "")}</span>
          </div>
        </button>
      ) : (
        <p className="text-sm text-muted">{bed.status === "available" ? "Siap menerima pasien" : bed.status === "cleaning" ? "Menunggu housekeeping" : bed.status === "reserved" ? "Dipesan untuk admisi terencana" : "Tidak dapat dipakai"}</p>
      )}
    </Card>
  )
}
