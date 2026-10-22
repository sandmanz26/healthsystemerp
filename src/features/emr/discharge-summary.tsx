/**
 * Printable discharge summary, generated from what was charted rather than retyped.
 * US: the discharge summary required by CMS Conditions of Participation (§482.24).
 * UK: the Transfer of Care document to the GP, following the PRSB eDischarge headings.
 */
import { frequencyLabel } from "@/domain/catalog"
import { REGIONS } from "@/domain/region"
import type { Encounter, Patient } from "@/domain/types"
import { formatNhsNumber } from "@/domain/interop"
import { formatDate, formatDateTime } from "@/lib/format"
import { useStore } from "@/store"
import { useInventoryMap, useRegion, useStaffMap, useUnitName } from "@/store/selectors"

const KIND = {
  us: { outpatient: "Outpatient visit", emergency: "Emergency department visit", inpatient: "Inpatient stay" },
  uk: { outpatient: "Outpatient attendance", emergency: "A&E attendance", inpatient: "Inpatient spell" },
}

export function DischargeSummary({ encounter, patient, dispositionLabel }: { encounter: Encounter; patient: Patient; dispositionLabel: string }) {
  const facility = useStore((s) => s.facility)
  const allRx = useStore((s) => s.prescriptions)
  const region = useRegion()
  const info = REGIONS[region]
  const staff = useStaffMap()
  const items = useInventoryMap()
  const unitName = useUnitName()
  const lastDoctorNote = [...encounter.notes].filter((n) => n.role === "doctor").sort((a, b) => b.at.localeCompare(a.at))[0]
  const meds = allRx.filter((r) => r.encounterId === encounter.id && r.status !== "cancelled").flatMap((r) => r.items)
  const clinician = staff.get(encounter.practitionerId ?? "")
  const us = region === "us"

  return (
    <div className="print-area hidden space-y-3 p-8 text-sm text-black print:block">
      <div className="border-b border-black pb-2">
        <div className="text-lg font-bold">{facility.name}</div>
        <div>
          {us ? "DISCHARGE SUMMARY" : "DISCHARGE SUMMARY TO GP (TRANSFER OF CARE)"} — {KIND[region][encounter.kind]}
        </div>
      </div>
      <table className="w-full">
        <tbody>
          <tr>
            <td className="w-48">Patient / MRN</td>
            <td>
              {patient.name} / {patient.mrn}
            </td>
          </tr>
          {!us && patient.nhsNumber && (
            <tr>
              <td>NHS number</td>
              <td>{formatNhsNumber(patient.nhsNumber)}</td>
            </tr>
          )}
          <tr>
            <td>Date of birth / sex</td>
            <td>
              {formatDate(patient.birthDate)} ({patient.gender === "female" ? "F" : "M"})
            </td>
          </tr>
          <tr>
            <td>{us ? "Admitted / discharged" : "Admission / discharge"}</td>
            <td>
              {formatDateTime(encounter.startedAt ?? encounter.createdAt)} — {encounter.endedAt ? formatDateTime(encounter.endedAt) : "-"}
            </td>
          </tr>
          <tr>
            <td>{us ? "Unit / attending" : "Ward / responsible consultant"}</td>
            <td>
              {unitName(encounter.unitId)} / {clinician?.name ?? "-"}
            </td>
          </tr>
          <tr>
            <td>{us ? "Account number" : "Spell number"}</td>
            <td>{encounter.accountNumber}</td>
          </tr>
          {us && encounter.admissionClass && (
            <tr>
              <td>Status</td>
              <td>{encounter.admissionClass === "observation" ? "Outpatient observation" : "Inpatient"}</td>
            </tr>
          )}
          {patient.primaryCare && (
            <tr>
              <td>{us ? "Primary care provider" : "Registered GP practice"}</td>
              <td>{patient.primaryCare}</td>
            </tr>
          )}
        </tbody>
      </table>
      <div>
        <b>{us ? "Reason for admission / chief complaint" : "Presenting complaint"}:</b> {encounter.chiefComplaint}
      </div>
      {lastDoctorNote && (
        <div>
          <b>{us ? "Hospital course" : "Clinical summary"}:</b> {lastDoctorNote.subjective} {lastDoctorNote.objective} {lastDoctorNote.assessment}
        </div>
      )}
      <div>
        <b>Diagnoses ({info.dxSystem}):</b>
        <ul className="list-inside list-disc">
          {encounter.diagnoses.map((d) => (
            <li key={d.code}>
              {d.code} {d.display}
              {d.primary ? (us ? " (principal)" : " (primary)") : ""}
            </li>
          ))}
        </ul>
      </div>
      {encounter.procedures.length > 0 && (
        <div>
          <b>Procedures ({us ? "CPT" : "OPCS-4"}):</b> {encounter.procedures.map((p) => `${p.code} ${p.display}`).join("; ")}
        </div>
      )}
      <div>
        <b>Allergies:</b> {patient.allergies.length ? patient.allergies.map((a) => `${a.substance} (${a.reaction})`).join("; ") : "No known drug allergies"}
      </div>
      {meds.length > 0 && (
        <div>
          <b>{us ? "Discharge medications" : "Medications on discharge (TTO)"}:</b> {meds.map((m) => `${items.get(m.itemId)?.name} ${m.dose} ${m.route} ${frequencyLabel(m.frequency, region)}`).join("; ")}
        </div>
      )}
      <div>
        <b>{us ? "Discharge disposition" : "Discharge destination"}:</b> {dispositionLabel}
        {encounter.dispositionNote ? ` — ${encounter.dispositionNote}` : ""}
      </div>
      {lastDoctorNote?.plan && (
        <div>
          <b>{us ? "Follow-up instructions" : "Actions for GP"}:</b> {lastDoctorNote.plan}
        </div>
      )}
      <div className="pt-10 text-right">
        {us ? "Attending physician" : "Responsible consultant"},
        <br />
        <br />
        <br />
        {clinician?.name}
        {us && clinician?.npi && <div>NPI {clinician.npi}</div>}
        {!us && clinician?.license && (
          <div>
            {clinician.license.body} {clinician.license.number}
          </div>
        )}
      </div>
    </div>
  )
}
