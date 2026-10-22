/**
 * Close the encounter with a disposition. The checklist mirrors what coding, claim edits and
 * medical-record completion will ask later, so problems are fixed now instead of bouncing back.
 */
import { Button } from "@heroui/react"
import { CheckCircle2, Circle, CircleAlert, Printer } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { SelectInput, TextAreaInput } from "@v2/components/ui/fields"
import { Panel } from "@v2/components/ui/panel"
import { REGIONS, type Region } from "@v2/domain/region"
import type { Disposition, Encounter } from "@v2/domain/types"
import { toast } from "@v2/lib/toast"
import { useActions, useStore } from "@v2/store"
import { useModuleEnabled, useRegion } from "@v2/store/selectors"
import { DischargeSummary } from "./discharge-summary"

/** Disposition labels. US wording follows UB-04 patient status; UK follows the NHS discharge destination data item. */
const DISPOSITION_LABEL: Record<Region, Record<Disposition, string>> = {
  us: {
    home: "Discharged home / self-care",
    "home-health": "Home with home health",
    "follow-up": "Discharged home, follow-up arranged",
    admit: "Admit to inpatient",
    transfer: "Transfer to another acute facility",
    snf: "Skilled nursing facility",
    hospice: "Hospice",
    ama: "Left AMA (against medical advice)",
    expired: "Expired",
  },
  uk: {
    home: "Discharged to usual residence",
    "home-health": "Usual residence with community care package",
    "follow-up": "Usual residence, outpatient follow-up booked",
    admit: "Admit to ward",
    transfer: "Transfer to another NHS acute provider",
    snf: "Care home with nursing",
    hospice: "Hospice / end-of-life care",
    ama: "Self-discharged against clinical advice",
    expired: "Died",
  },
}

const OPTIONS: Record<Encounter["kind"], Disposition[]> = {
  outpatient: ["home", "follow-up", "transfer", "admit"],
  emergency: ["home", "follow-up", "admit", "transfer", "ama", "expired"],
  inpatient: ["home", "home-health", "follow-up", "snf", "hospice", "transfer", "ama", "expired"],
}

export function FinishPanel({ encounter }: { encounter: Encounter }) {
  const { finishEncounter, discharge, callPatient, startEncounter } = useActions()
  const patient = useStore((s) => s.patients.find((p) => p.id === encounter.patientId))
  const navigate = useNavigate()
  const region = useRegion()
  const labels = DISPOSITION_LABEL[region]
  // Select the stable collections, then filter: a selector returning a new array each call
  // would re-render forever.
  const allOrders = useStore((s) => s.orders)
  const allRx = useStore((s) => s.prescriptions)
  const orders = allOrders.filter((o) => o.encounterId === encounter.id)
  const rx = allRx.filter((p) => p.encounterId === encounter.id)
  const inpatientOn = useModuleEnabled("inpatient")
  const [disposition, setDisposition] = useState<Disposition | null>(null)
  const [note, setNote] = useState("")
  const options = OPTIONS[encounter.kind].filter((d) => d !== "admit" || inpatientOn)
  const us = region === "us"

  const checks = [
    { ok: encounter.diagnoses.some((d) => d.primary), label: `${us ? "Principal" : "Primary"} diagnosis (${REGIONS[region].dxSystem})`, required: true },
    { ok: encounter.notes.some((n) => n.role === "doctor"), label: us ? "Provider note signed" : "Clinician note completed", required: true },
    ...(us && encounter.kind === "inpatient" ? [{ ok: encounter.diagnoses.every((d) => !!d.poa), label: "POA indicator on every diagnosis", required: false }] : []),
    ...(us && encounter.payer !== "self-pay" ? [{ ok: encounter.eligibility?.status === "active", label: "Eligibility verified (X12 271)", required: false }] : []),
    ...(us && encounter.kind === "inpatient" && encounter.payer === "commercial" && encounter.admissionClass === "inpatient" ? [{ ok: !!encounter.authNumber, label: "Inpatient authorization on file", required: false }] : []),
    ...(us && encounter.dischargePlan?.imNotice === false ? [{ ok: false, label: "Follow-up Important Message from Medicare", required: false }] : []),
    { ok: !orders.some((o) => o.status !== "validated" && o.status !== "cancelled"), label: "All lab & imaging results final", required: false },
    { ok: !rx.some((p) => p.status === "new"), label: us ? "Medication orders verified by pharmacy" : "Prescriptions screened by pharmacy", required: false },
  ]
  const blocked = checks.some((c) => c.required && !c.ok)

  if (encounter.status === "finished" || encounter.status === "cancelled") {
    return (
      <Panel title={encounter.status === "cancelled" ? "Encounter cancelled" : "Encounter closed"}>
        <p className="text-sm">
          Disposition: <b>{encounter.disposition ? labels[encounter.disposition] : "Cancelled"}</b>
        </p>
        {encounter.dispositionNote && <p className="mt-1 text-sm text-muted">{encounter.dispositionNote}</p>}
        {encounter.status === "finished" && patient && (
          <>
            <Button className="mt-3" variant="tertiary" fullWidth onPress={() => window.print()}>
              <Printer className="size-4" aria-hidden /> {us ? "Print discharge summary" : "Print discharge summary (TOC)"}
            </Button>
            <DischargeSummary encounter={encounter} patient={patient} dispositionLabel={encounter.disposition ? labels[encounter.disposition] : "-"} />
          </>
        )}
      </Panel>
    )
  }
  if (encounter.status === "awaiting-admission") {
    return (
      <Panel title="Awaiting admission">
        <p className="text-sm text-muted">{us ? "Admission request sent to bed management. The patient is boarding until a bed is assigned from the bed board." : "Decision to admit recorded. The patient waits in the department until a ward bed is allocated from the bed board."}</p>
        {inpatientOn && (
          <Button className="mt-3" variant="secondary" fullWidth onPress={() => navigate("/inpatient")}>
            Open bed board
          </Button>
        )}
      </Panel>
    )
  }

  const submit = () => {
    if (!disposition) return
    if (encounter.kind === "inpatient") discharge(encounter.id, disposition, note || undefined)
    else finishEncounter(encounter.id, disposition, note || undefined)
    // Clinic rhythm: finish → call the next patient in one tap, without going back to the list.
    const next =
      encounter.kind === "outpatient"
        ? useStore
            .getState()
            .encounters.filter((e) => e.kind === "outpatient" && e.unitId === encounter.unitId && e.practitionerId === encounter.practitionerId && e.status === "registered")
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
        : undefined
    toast.success(disposition === "admit" ? "Admission requested" : encounter.kind === "inpatient" ? "Patient discharged" : "Encounter closed", {
      description: labels[disposition],
      actionProps: next
        ? {
            children: `Call ${next.queueNumber}`,
            onPress: () => {
              callPatient(next.id)
              startEncounter(next.id)
              navigate(`/encounters/${next.id}`)
            },
          }
        : undefined,
      timeout: next ? 8000 : undefined,
    })
    navigate(encounter.kind === "outpatient" ? "/outpatient" : encounter.kind === "emergency" ? "/emergency" : "/inpatient")
  }

  return (
    <Panel title={encounter.kind === "inpatient" ? "Discharge patient" : "Close encounter"}>
      <ul className="mb-4 space-y-1.5 text-sm">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center gap-2">
            {c.ok ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : c.required ? <CircleAlert className="size-4 text-danger" aria-hidden /> : <Circle className="size-4 text-muted" aria-hidden />}
            <span className={!c.ok && c.required ? "font-medium text-danger" : undefined}>
              {c.label}
              {!c.ok && !c.required && <span className="text-muted"> (optional)</span>}
            </span>
          </li>
        ))}
      </ul>
      <div className="space-y-3">
        <SelectInput label="Disposition" value={disposition} onChange={setDisposition} options={options.map((d) => ({ value: d, label: labels[d] }))} isRequired placeholder="Select…" />
        <TextAreaInput
          label="Note"
          value={note}
          onChange={setNote}
          rows={2}
          placeholder={disposition === "transfer" ? "Receiving facility, accepting physician & reason" : disposition === "admit" ? (us ? "Requested unit / level of care (med-surg, tele, ICU)" : "Requested ward / specialty") : disposition === "ama" ? "Risks explained; capacity assessed; form signed?" : "Optional"}
        />
        <Button variant="primary" fullWidth isDisabled={!disposition || blocked} onPress={submit}>
          {blocked ? "Complete required items first" : encounter.kind === "inpatient" ? "Discharge" : disposition === "admit" ? "Request admission" : "Close encounter"}
        </Button>
      </div>
    </Panel>
  )
}
