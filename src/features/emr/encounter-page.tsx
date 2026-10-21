/**
 * The encounter workspace — one screen per visit for every encounter kind.
 * Tabs follow the clinician's flow (note → diagnose → order → prescribe → vitals);
 * the right rail keeps the patient summary and closing checklist in view.
 */
import { Button, Chip, Tabs } from "@heroui/react"
import { ArrowLeft, BedDouble, HeartPulse } from "lucide-react"
import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { EncounterStatusChip, TriageChip } from "@/components/status"
import { Empty } from "@/components/ui/empty"
import { Page } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import { formatDateTime } from "@/lib/format"
import { useNow } from "@/lib/use-now"
import { PatientBanner } from "@/features/patients/patient-banner"
import { useStore } from "@/store"
import { useEncounter, useModuleEnabled, useSession, useStaffMap, useUnitName } from "@/store/selectors"
import { VitalsGrid } from "./clinical-widgets"
import { DiagnosisSection } from "./diagnosis-section"
import { FinishPanel } from "./finish-panel"
import { OrdersSection } from "./orders-section"
import { PrescriptionSection } from "./prescription-section"
import { SoapSection } from "./soap-section"
import { VitalsDialog } from "./vitals-dialog"

const BACK: Record<string, { to: string; label: string }> = {
  outpatient: { to: "/outpatient", label: "Rawat Jalan" },
  emergency: { to: "/emergency", label: "IGD" },
  inpatient: { to: "/inpatient", label: "Rawat Inap" },
}

export default function EncounterPage() {
  const { id } = useParams()
  const encounter = useEncounter(id)
  const patient = useStore((s) => s.patients.find((p) => p.id === encounter?.patientId))
  const bed = useStore((s) => s.beds.find((b) => b.id === encounter?.bedId))
  const staff = useStaffMap()
  const unitName = useUnitName()
  const { role } = useSession()
  const pharmacyOn = useModuleEnabled("pharmacy")
  const labOn = useModuleEnabled("laboratory")
  const radOn = useModuleEnabled("radiology")
  const ordersOn = labOn || radOn
  const [vitalsOpen, setVitalsOpen] = useState(false)
  const now = useNow()

  if (!encounter || !patient) return <Page><Empty title="Kunjungan tidak ditemukan" /></Page>

  const closed = encounter.status === "finished" || encounter.status === "cancelled"
  const canWriteNotes = !closed && (role === "doctor" || role === "nurse")
  const canOrder = !closed && role === "doctor"
  const back = BACK[encounter.kind]
  const latest = [...encounter.vitals].sort((a, b) => b.at.localeCompare(a.at))
  const los = encounter.kind === "inpatient" ? Math.max(1, Math.ceil((now - new Date(encounter.startedAt ?? encounter.createdAt).getTime()) / 86400000)) : null

  return (
    <Page>
      <Link to={back.to} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> {back.label}
      </Link>
      <div className="mb-5">
        <PatientBanner
          patient={patient}
          encounter={encounter}
          aside={
            <>
              {encounter.kind === "emergency" && <TriageChip level={encounter.triage} />}
              {bed && (
                <Chip size="sm" variant="soft">
                  <BedDouble className="size-3.5" aria-hidden /> {bed.code} · hari ke-{los}
                </Chip>
              )}
              <EncounterStatusChip status={encounter.status} />
            </>
          }
        />
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-muted">
          <span>{unitName(encounter.unitId)}</span>
          <span>DPJP: {staff.get(encounter.practitionerId ?? "")?.name ?? "—"}</span>
          <span>Masuk {formatDateTime(encounter.createdAt)}</span>
          {encounter.queueNumber && <span>Antrean {encounter.queueNumber}</span>}
          <span>
            Keluhan: <b className="text-foreground">{encounter.chiefComplaint}</b>
          </span>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Tabs className="min-w-0">
          <Tabs.ListContainer>
            <Tabs.List aria-label="Rekam medis kunjungan">
              <Tabs.Tab className="whitespace-nowrap" id="soap">CPPT<Tabs.Indicator /></Tabs.Tab>
              <Tabs.Tab className="whitespace-nowrap" id="dx">Diagnosis{encounter.diagnoses.length > 0 && ` (${encounter.diagnoses.length})`}<Tabs.Indicator /></Tabs.Tab>
              {ordersOn && <Tabs.Tab className="whitespace-nowrap" id="orders">Penunjang<Tabs.Indicator /></Tabs.Tab>}
              {pharmacyOn && <Tabs.Tab className="whitespace-nowrap" id="rx">Resep<Tabs.Indicator /></Tabs.Tab>}
              <Tabs.Tab className="whitespace-nowrap" id="vitals">Tanda vital ({encounter.vitals.length})<Tabs.Indicator /></Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel id="soap" className="pt-4">
            <SoapSection encounter={encounter} readOnly={!canWriteNotes} />
          </Tabs.Panel>
          <Tabs.Panel id="dx" className="pt-4">
            <DiagnosisSection encounter={encounter} readOnly={!canOrder} />
          </Tabs.Panel>
          {ordersOn && (
            <Tabs.Panel id="orders" className="pt-4">
              <OrdersSection encounter={encounter} readOnly={!canOrder} />
            </Tabs.Panel>
          )}
          {pharmacyOn && (
            <Tabs.Panel id="rx" className="pt-4">
              <PrescriptionSection encounter={encounter} patient={patient} readOnly={!canOrder} />
            </Tabs.Panel>
          )}
          <Tabs.Panel id="vitals" className="pt-4">
            <Panel
              title="Riwayat tanda vital"
              actions={
                canWriteNotes && (
                  <Button size="sm" variant="primary" onPress={() => setVitalsOpen(true)}>
                    <HeartPulse className="size-4" aria-hidden /> Input TTV
                  </Button>
                )
              }
              flush
            >
              {latest.length === 0 ? (
                <Empty title="Belum ada tanda vital" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="tabular w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-separator text-left text-xs text-muted">
                        {["Waktu", "TD", "Nadi", "Napas", "Suhu", "SpO₂", "Kesadaran"].map((h) => (
                          <th key={h} className="px-4 py-2 font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-separator">
                      {latest.map((v) => (
                        <tr key={v.id}>
                          <td className="px-4 py-2">{formatDateTime(v.at)}</td>
                          <td className="px-4 py-2">{v.systolic ? `${v.systolic}/${v.diastolic ?? "-"}` : "—"}</td>
                          <td className="px-4 py-2">{v.heartRate ?? "—"}</td>
                          <td className="px-4 py-2">{v.respRate ?? "—"}</td>
                          <td className="px-4 py-2">{v.temperature ?? "—"}</td>
                          <td className="px-4 py-2">
                            {v.spo2 ?? "—"}
                            {v.onOxygen ? " (O₂)" : ""}
                          </td>
                          <td className="px-4 py-2">{v.consciousness ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </Tabs.Panel>
        </Tabs>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Panel title="Tanda vital terakhir">
            <VitalsGrid vitals={latest[0]} />
          </Panel>
          {(role === "doctor" || role === "admin" || closed) && <FinishPanel encounter={encounter} />}
        </aside>
      </div>
      {vitalsOpen && <VitalsDialog encounterId={encounter.id} patientName={patient.name} onClose={() => setVitalsOpen(false)} />}
    </Page>
  )
}
