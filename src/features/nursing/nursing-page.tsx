/**
 * Ward nursing station: patients ranked by early-warning score, the medication round
 * (eMAR) and shift handover (SBAR) — the three things a nurse checks every shift.
 */
import { Button, Chip, Tabs } from "@heroui/react"
import { AlertTriangle, ClipboardPen, HeartPulse, Pill, Timer } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { VitalsStrip } from "@/components/clinical/vitals-monitor"
import { MarkerDots } from "@/components/clinical/wristband"
import { Dialog } from "@/components/ui/dialog"
import { Empty } from "@/components/ui/empty"
import { SelectInput, TextAreaInput } from "@/components/ui/fields"
import { Page, PageHeader } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import { Stat } from "@/components/ui/stat"
import { ageLabel, minutesSince, news2 } from "@/domain/clinical"
import type { Encounter, MarEntry, MarStatus } from "@/domain/types"
import { News2Chip } from "@/features/emr/clinical-widgets"
import { VitalsDialog } from "@/features/emr/vitals-dialog"
import { cn } from "@/lib/cn"
import { formatDateTime, formatDuration, formatRelative, formatTime } from "@/lib/format"
import { usePrefs } from "@/lib/prefs"
import { toast } from "@/lib/toast"
import { useNow } from "@/lib/use-now"
import { useActions, useStore } from "@/store"
import { useInventoryMap, usePatientMap, useSession, useStaffMap } from "@/store/selectors"

/** Observation interval (minutes) required by the NEWS2 response protocol. */
function observationInterval(e: Encounter): number {
  const latest = [...e.vitals].sort((a, b) => b.at.localeCompare(a.at))[0]
  const s = latest ? news2(latest) : null
  if (!s) return 240
  if (s.risk === "tinggi") return 15
  if (s.risk === "sedang") return 60
  return s.score === 0 ? 720 : 240
}

export default function NursingPage() {
  const units = useStore((s) => s.units)
  const encounters = useStore((s) => s.encounters)
  const beds = useStore((s) => s.beds)
  const mar = useStore((s) => s.mar)
  const patients = usePatientMap()
  const items = useInventoryMap()
  const { user } = useSession()
  const now = useNow()
  const wards = units.filter((u) => u.kind === "ward" || u.kind === "icu")
  const saved = usePrefs((s) => s.unitFilter.nursing)
  const setUnitFilter = usePrefs((s) => s.setUnitFilter)
  const ward = saved ?? wards.find((w) => w.id === user?.unitId)?.id ?? wards[0].id
  const [vitalsFor, setVitalsFor] = useState<Encounter>()
  const [handoverFor, setHandoverFor] = useState<Encounter>()
  const [marAction, setMarAction] = useState<{ entry: MarEntry; status: MarStatus }>()

  const inWard = encounters
    .filter((e) => e.kind === "inpatient" && e.status === "in-progress" && e.unitId === ward)
    .map((e) => {
      const latest = [...e.vitals].sort((a, b) => b.at.localeCompare(a.at))[0]
      return { e, latest, score: latest ? news2(latest)?.score ?? -1 : -1, overdue: latest ? minutesSince(latest.at, now) > observationInterval(e) : true }
    })
    .sort((a, b) => b.score - a.score)
  const encIds = new Set(inWard.map((x) => x.e.id))
  const wardMar = mar.filter((m) => encIds.has(m.encounterId) && new Date(m.scheduledAt).toDateString() === new Date(now).toDateString()).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  const dueSoon = wardMar.filter((m) => m.status === "due" && new Date(m.scheduledAt).getTime() < now + 2 * 3600000)
  const late = wardMar.filter((m) => m.status === "due" && new Date(m.scheduledAt).getTime() < now - 30 * 60000)
  const encById = new Map(inWard.map((x) => [x.e.id, x.e]))

  return (
    <Page>
      <PageHeader
        title="Keperawatan"
        description="Pasien diurutkan dari skor NEWS2 tertinggi. Observasi terlambat ditandai merah sesuai protokol NEWS2."
        actions={<SelectInput label="Ruangan" className="w-64" value={ward} onChange={(v) => setUnitFilter("nursing", v)} options={wards.map((w) => ({ value: w.id, label: w.name }))} />}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pasien di ruangan" value={inWard.length} icon={HeartPulse} tone="accent" />
        <Stat label="NEWS2 ≥ 5" value={inWard.filter((x) => x.score >= 5).length} icon={AlertTriangle} tone={inWard.some((x) => x.score >= 5) ? "danger" : "success"} />
        <Stat label="Observasi terlambat" value={inWard.filter((x) => x.overdue).length} icon={Timer} tone={inWard.some((x) => x.overdue) ? "warning" : "success"} />
        <Stat label="Obat 2 jam ke depan" value={dueSoon.length} hint={late.length ? `${late.length} terlambat` : "Tidak ada yang terlambat"} icon={Pill} tone={late.length ? "danger" : "default"} />
      </div>

      <Tabs>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Keperawatan">
            <Tabs.Tab className="whitespace-nowrap" id="patients">Pasien<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab className="whitespace-nowrap" id="mar">Pemberian obat (eMAR)<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab className="whitespace-nowrap" id="handover">Serah terima<Tabs.Indicator /></Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="patients" className="pt-4">
          {inWard.length === 0 ? (
            <Panel><Empty title="Tidak ada pasien di ruangan ini" /></Panel>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {inWard.map(({ e, latest, overdue }) => {
                const p = patients.get(e.patientId)!
                const s = latest ? news2(latest) : null
                return (
                  <Panel key={e.id} className={cn(s?.risk === "tinggi" && "ring-2 ring-danger", s?.risk === "sedang" && "ring-1 ring-warning")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="tabular rounded-md bg-surface-secondary px-1.5 py-0.5 text-xs font-bold">{beds.find((b) => b.id === e.bedId)?.code}</span>
                          <Link to={`/encounters/${e.id}`} className="truncate font-semibold hover:underline">
                            {p.name}
                          </Link>
                          <MarkerDots patient={p} />
                        </div>
                        <div className="text-xs text-muted">
                          {p.gender === "female" ? "P" : "L"} · {ageLabel(p.birthDate)} · {e.diagnoses.find((d) => d.primary)?.display}
                        </div>
                      </div>
                      <News2Chip vitals={latest} />
                    </div>
                    <div className="mt-3">
                      <VitalsStrip vitals={latest} />
                    </div>
                    {s && s.risk !== "rendah" && <p className={cn("mt-2 rounded-lg px-3 py-1.5 text-xs", s.risk === "tinggi" ? "bg-danger-soft text-danger-soft-foreground" : "bg-warning-soft text-warning-soft-foreground")}>{s.response}</p>}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <span className={cn("text-xs", overdue ? "font-semibold text-danger" : "text-muted")}>
                        TTV terakhir {latest ? formatRelative(latest.at, now) : "belum ada"}
                        {overdue && " · observasi terlambat"}
                      </span>
                      <div className="flex gap-1">
                        <Button size="sm" variant="tertiary" onPress={() => setHandoverFor(e)}>
                          SBAR
                        </Button>
                        <Button size="sm" variant="primary" onPress={() => setVitalsFor(e)}>
                          Input TTV
                        </Button>
                      </div>
                    </div>
                  </Panel>
                )
              })}
            </div>
          )}
        </Tabs.Panel>

        <Tabs.Panel id="mar" className="pt-4">
          <Panel flush>
            {wardMar.length === 0 ? (
              <Empty icon={Pill} title="Tidak ada jadwal obat hari ini" />
            ) : (
              <ul className="divide-y divide-separator">
                {wardMar.map((m) => {
                  const enc = encById.get(m.encounterId)!
                  const p = patients.get(enc.patientId)!
                  const item = items.get(m.itemId)
                  const isLate = m.status === "due" && new Date(m.scheduledAt).getTime() < now - 30 * 60000
                  return (
                    <li key={m.id} className={cn("flex flex-wrap items-center gap-3 px-5 py-3", isLate && "bg-danger-soft/40")}>
                      <div className="tabular w-14 text-sm font-bold">{formatTime(m.scheduledAt)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          {item?.name}
                          {item?.highAlert && (
                            <Chip size="sm" color="danger" variant="primary">
                              High alert — double check
                            </Chip>
                          )}
                        </div>
                        <div className="text-xs text-muted">
                          {m.dose} · {m.route} · {beds.find((b) => b.id === enc.bedId)?.code} {p.name}
                          {p.allergies.length > 0 && <span className="font-semibold text-danger"> · alergi {p.allergies.map((a) => a.substance).join(", ")}</span>}
                        </div>
                      </div>
                      {m.status === "due" ? (
                        <div className="flex gap-1">
                          {isLate && <span className="self-center text-xs font-semibold text-danger">terlambat {formatDuration(minutesSince(m.scheduledAt, now))}</span>}
                          <Button size="sm" variant="ghost" onPress={() => setMarAction({ entry: m, status: "held" })}>
                            Tunda
                          </Button>
                          <Button size="sm" variant="primary" onPress={() => setMarAction({ entry: m, status: "given" })}>
                            Beri
                          </Button>
                        </div>
                      ) : (
                        <Chip size="sm" variant="soft" color={m.status === "given" ? "success" : "warning"}>
                          {m.status === "given" ? "Diberikan" : m.status === "held" ? "Ditunda" : "Ditolak pasien"} {m.at && formatTime(m.at)}
                        </Chip>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
        </Tabs.Panel>

        <Tabs.Panel id="handover" className="space-y-3 pt-4">
          {inWard.map(({ e }) => {
            const p = patients.get(e.patientId)!
            const last = [...e.handovers].sort((a, b) => b.at.localeCompare(a.at))[0]
            return (
              <Panel
                key={e.id}
                title={`${beds.find((b) => b.id === e.bedId)?.code} · ${p.name}`}
                description={last ? `Terakhir ${formatDateTime(last.at)}` : "Belum ada catatan serah terima"}
                actions={
                  <Button size="sm" variant="tertiary" onPress={() => setHandoverFor(e)}>
                    <ClipboardPen className="size-4" aria-hidden /> Tulis SBAR
                  </Button>
                }
              >
                {last ? (
                  <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                    <dt className="font-semibold text-muted">S</dt>
                    <dd>{last.situation}</dd>
                    <dt className="font-semibold text-muted">B</dt>
                    <dd>{last.background}</dd>
                    <dt className="font-semibold text-muted">A</dt>
                    <dd>{last.assessment}</dd>
                    <dt className="font-semibold text-muted">R</dt>
                    <dd>{last.recommendation}</dd>
                  </dl>
                ) : (
                  <p className="text-sm text-muted">—</p>
                )}
              </Panel>
            )
          })}
        </Tabs.Panel>
      </Tabs>

      {vitalsFor && <VitalsDialog encounterId={vitalsFor.id} patientName={patients.get(vitalsFor.patientId)?.name ?? ""} onClose={() => setVitalsFor(undefined)} />}
      {handoverFor && <HandoverDialog encounter={handoverFor} onClose={() => setHandoverFor(undefined)} />}
      {marAction && <MarDialog entry={marAction.entry} status={marAction.status} onClose={() => setMarAction(undefined)} />}
    </Page>
  )
}

function HandoverDialog({ encounter, onClose }: { encounter: Encounter; onClose: () => void }) {
  const { addHandover } = useActions()
  const patient = useStore((s) => s.patients.find((p) => p.id === encounter.patientId))
  const [f, setF] = useState({ situation: "", background: encounter.diagnoses.map((d) => d.display).join(", "), assessment: "", recommendation: "" })
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }))
  return (
    <Dialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      isDismissable={false}
      size="lg"
      title="Serah terima (SBAR)"
      description={patient?.name}
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            isDisabled={!f.situation.trim() || !f.recommendation.trim()}
            onPress={() => {
              addHandover(encounter.id, f)
              toast.success("Catatan serah terima tersimpan")
              onClose()
            }}
          >
            Simpan
          </Button>
        </>
      }
    >
      <TextAreaInput label="S — Situation" value={f.situation} onChange={set("situation")} rows={2} placeholder="Kondisi pasien saat ini" isRequired />
      <TextAreaInput label="B — Background" value={f.background} onChange={set("background")} rows={2} placeholder="Diagnosis, riwayat, terapi" />
      <TextAreaInput label="A — Assessment" value={f.assessment} onChange={set("assessment")} rows={2} placeholder="Penilaian perawat, NEWS2, risiko" />
      <TextAreaInput label="R — Recommendation" value={f.recommendation} onChange={set("recommendation")} rows={2} placeholder="Yang perlu dilakukan shift berikutnya" isRequired />
    </Dialog>
  )
}

function MarDialog({ entry, status, onClose }: { entry: MarEntry; status: MarStatus; onClose: () => void }) {
  const { recordMar } = useActions()
  const item = useStore((s) => s.inventory.find((i) => i.id === entry.itemId))
  const staff = useStaffMap()
  const { user } = useSession()
  const [reason, setReason] = useState<MarStatus>(status)
  const [note, setNote] = useState("")
  const [verifier, setVerifier] = useState<string | null>(null)
  const nurses = [...staff.values()].filter((s) => s.role === "nurse" && s.id !== user?.id)
  const needsDoubleCheck = status === "given" && item?.highAlert

  return (
    <Dialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={status === "given" ? "Konfirmasi pemberian obat" : "Obat tidak diberikan"}
      description={`${item?.name} · ${entry.dose} · ${entry.route} · jadwal ${formatTime(entry.scheduledAt)}`}
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Batal
          </Button>
          <Button
            variant={status === "given" ? "primary" : "danger-soft"}
            isDisabled={(needsDoubleCheck && !verifier) || (status !== "given" && !note.trim())}
            onPress={() => {
              recordMar(entry.id, reason, [note, verifier ? `double check: ${staff.get(verifier)?.name}` : ""].filter(Boolean).join(" · ") || undefined)
              toast.success(status === "given" ? "Pemberian obat tercatat" : "Penundaan tercatat")
              onClose()
            }}
          >
            Simpan
          </Button>
        </>
      }
    >
      {status === "given" ? (
        <ul className="space-y-1 text-sm">
          <li>✓ Benar pasien — cek gelang (nama + No. RM)</li>
          <li>✓ Benar obat, dosis, rute, waktu</li>
          <li>✓ Benar dokumentasi</li>
        </ul>
      ) : (
        <SelectInput
          label="Alasan"
          value={reason}
          onChange={setReason}
          options={[
            { value: "held", label: "Ditunda (mis. puasa, TD rendah)" },
            { value: "refused", label: "Ditolak pasien" },
          ]}
        />
      )}
      {needsDoubleCheck && <SelectInput label="Perawat kedua (double check high-alert)" value={verifier} onChange={setVerifier} options={nurses.map((n) => ({ value: n.id, label: n.name }))} isRequired />}
      <TextAreaInput label="Catatan" value={note} onChange={setNote} rows={2} isRequired={status !== "given"} />
    </Dialog>
  )
}
