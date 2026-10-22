/**
 * Patient registry, registration, encounter documentation, inpatient flow (ADT) and nursing.
 */
import { MORSE_ITEMS, BRADEN_ITEMS } from "@/domain/clinical"
import { formatMrn } from "@/domain/region"
import type {
  AdmissionClass, Allergy, AssessmentKind, BedStatus, ClinicalNote, CodeStatus, Diagnosis, DischargePlan, Disposition, Encounter,
  EncounterKind, HandoverNote, MarStatus, Patient, PayerType, Procedure, TriageLevel, Vitals,
} from "@/domain/types"
import type { TariffKey } from "@/domain/catalog"
import { uid } from "@/lib/id"
import {
  addTariff, audit, findEncounter, isOn, nextAccountNumber, nextQueueNumber, notify, nowIso, patientName, queueSync, regionOf,
  type Draft, type SetFn,
} from "../helpers"
import { createClaimIfNeeded } from "./finance"

export type NewPatient = Omit<Patient, "id" | "mrn" | "createdAt">

export interface RegisterVisitInput {
  patientId: string
  kind: Exclude<EncounterKind, "inpatient">
  unitId: string
  practitionerId?: string
  payer: PayerType
  complaint: string
  referralNumber?: string
  appointmentId?: string
}

const QUEUE_PREFIX: Record<string, string> = {
  "clinic-fm": "F", "clinic-im": "M", "clinic-cardio": "C", "clinic-peds": "P", "clinic-ob": "O", "clinic-surg": "S", "clinic-neuro": "N", ed: "ED",
}

/**
 * Simulated real-time eligibility. US: X12 270 → 271 through the clearinghouse. UK: a PDS
 * trace that confirms the NHS number and registered GP. Production calls the real service.
 */
function checkEligibility(d: Draft, enc: Encounter) {
  const patient = d.patients.find((p) => p.id === enc.patientId)!
  const region = regionOf(d)
  const reference = `${region === "us" ? "TRN" : "PDS"}-${Date.now().toString().slice(-8)}`
  if (region === "uk") {
    if (patient.payer !== "nhs") return
    enc.eligibility = patient.nhsNumber
      ? { at: nowIso(), status: "active", summary: `NHS number verified · Registered GP: ${patient.primaryCare ?? "unknown"}`, reference }
      : { at: nowIso(), status: "not-found", summary: "No PDS match — trace with demographics", reference }
    queueSync(d, "pds", "PDS trace", enc.id)
    return
  }
  if (patient.payer === "self-pay" || !patient.coverage) return
  enc.eligibility = {
    at: nowIso(),
    status: "active",
    summary: patient.payer === "medicare" ? "Part A & B active · Part A deductible met" : patient.payer === "medicaid" ? "Active · $0 copay" : "Active · Copay $40 · Deductible remaining $850",
    reference,
  }
  queueSync(d, "x12", "270/271", enc.id)
}

/** ED facility level (99281–99285) follows acuity until the coder assigns the final level. */
const edLevel = (triage?: TriageLevel): TariffKey => `ed-${triage ?? 3}` as TariffKey

function finishInternal(d: Draft, enc: Encounter, disposition: Disposition, note?: string) {
  enc.disposition = disposition
  enc.dispositionNote = note
  if (disposition === "admit" && enc.kind !== "inpatient") {
    // The encounter stays open until a bed is assigned — bed management works from this list.
    enc.status = "awaiting-admission"
    notify(d, { level: "info", title: "Admission request", body: `${patientName(d, enc.patientId)} needs a bed.`, href: "/inpatient", roles: ["nurse", "frontdesk", "admin"] })
    return
  }
  enc.status = "finished"
  enc.endedAt = nowIso()
  if (enc.kind === "outpatient") addTariff(d, enc, "clinic-est")
  if (enc.kind === "emergency") addTariff(d, enc, edLevel(enc.triage))
  queueSync(d, "hl7v2", "ADT^A03", enc.id)
  queueSync(d, "fhir", "Encounter", enc.id)
  createClaimIfNeeded(d, enc)
}

export function clinicalActions(set: SetFn) {
  return {
    createPatient(input: NewPatient): string {
      const id = uid("pt")
      set((d) => {
        d.mrnCounter += 37
        d.patients.unshift({ ...input, id, mrn: formatMrn(regionOf(d), d.mrnCounter), createdAt: nowIso() })
        audit(d, "Registered new patient", input.name)
      })
      return id
    },

    updatePatient(id: string, patch: Partial<NewPatient>) {
      set((d) => {
        const p = d.patients.find((x) => x.id === id)
        if (!p) return
        Object.assign(p, patch)
        audit(d, "Updated demographics", p.name)
      })
    },

    addAllergy(patientId: string, allergy: Allergy) {
      set((d) => {
        const p = d.patients.find((x) => x.id === patientId)
        if (!p) return
        p.allergies.push(allergy)
        audit(d, "Added allergy", `${p.name}: ${allergy.substance}`)
      })
    },

    removeAllergy(patientId: string, substance: string) {
      set((d) => {
        const p = d.patients.find((x) => x.id === patientId)
        if (!p) return
        p.allergies = p.allergies.filter((a) => a.substance !== substance)
        audit(d, "Removed allergy", `${p.name}: ${substance}`)
      })
    },

    setCodeStatus(patientId: string, status: CodeStatus) {
      set((d) => {
        const p = d.patients.find((x) => x.id === patientId)
        if (!p) return
        p.codeStatus = status
        audit(d, "Changed code status", `${p.name}: ${status}`)
      })
    },

    /** Access to a chart outside the user's care relationship, with a mandatory reason. */
    breakGlass(patientId: string, reason: string) {
      set((d) => {
        audit(d, "Break-the-glass access", patientName(d, patientId), { reason })
        notify(d, { level: "warning", title: "Break-the-glass access", body: `${patientName(d, patientId)} — "${reason}". Privacy officer review required.`, href: "/settings", roles: ["admin"] })
      })
    },

    registerVisit(input: RegisterVisitInput): string {
      const id = uid("enc")
      set((d) => {
        const patient = d.patients.find((p) => p.id === input.patientId)!
        const enc: Encounter = {
          id,
          kind: input.kind,
          patientId: input.patientId,
          unitId: input.unitId,
          practitionerId: input.practitionerId,
          payer: input.payer,
          status: "registered",
          accountNumber: nextAccountNumber(d),
          queueNumber: nextQueueNumber(d, input.unitId, QUEUE_PREFIX[input.unitId] ?? "Z"),
          createdAt: nowIso(),
          chiefComplaint: input.complaint,
          referralNumber: input.referralNumber,
          diagnoses: [],
          procedures: [],
          notes: [],
          vitals: [],
          handovers: [],
          assessments: [],
          exchange: isOn(d, "interop") ? "pending" : "not-required",
        }
        d.encounters.push(enc)
        if (isOn(d, "payer")) checkEligibility(d, enc)
        queueSync(d, "hl7v2", "ADT^A04", enc.id)
        if (input.appointmentId) {
          const ap = d.appointments.find((a) => a.id === input.appointmentId)
          if (ap) {
            ap.status = "checked-in"
            ap.encounterId = id
          }
        }
        audit(d, input.kind === "emergency" ? "Registered ED arrival" : "Registered visit", `${patient.name} · ${enc.queueNumber}`)
      })
      return id
    },

    /** Re-run eligibility (270/271 or PDS trace) for an encounter. */
    verifyEligibility(encounterId: string) {
      set((d) => {
        const enc = findEncounter(d, encounterId)
        checkEligibility(d, enc)
        audit(d, regionOf(d) === "us" ? "Eligibility check (270/271)" : "PDS trace", patientName(d, enc.patientId))
      })
    },

    recordAuthorization(encounterId: string, authNumber: string) {
      set((d) => {
        const enc = findEncounter(d, encounterId)
        enc.authNumber = authNumber
        audit(d, "Recorded prior authorization", `${patientName(d, enc.patientId)} · ${authNumber}`)
      })
    },

    cancelEncounter(encounterId: string, reason: string) {
      set((d) => {
        const enc = findEncounter(d, encounterId)
        enc.status = "cancelled"
        enc.dispositionNote = reason
        enc.endedAt = nowIso()
        const inv = d.invoices.find((i) => i.encounterId === enc.id)
        if (inv && inv.payments.length === 0) inv.status = "void"
        audit(d, "Cancelled visit", `${patientName(d, enc.patientId)} — ${reason}`)
      })
    },

    callPatient(encounterId: string) {
      set((d) => {
        const enc = findEncounter(d, encounterId)
        enc.status = "called"
        enc.calledAt = nowIso()
      })
    },

    startEncounter(encounterId: string) {
      set((d) => {
        const enc = findEncounter(d, encounterId)
        if (enc.status === "finished" || enc.status === "cancelled") return
        enc.status = "in-progress"
        enc.startedAt ??= nowIso()
        enc.practitionerId ??= d.session.role === "doctor" ? d.session.userId : enc.practitionerId
        audit(d, "Opened chart", patientName(d, enc.patientId))
      })
    },

    triage(encounterId: string, level: TriageLevel, vitals?: Omit<Vitals, "id" | "at" | "by">) {
      set((d) => {
        const enc = findEncounter(d, encounterId)
        enc.triage = level
        if (enc.status === "registered") enc.status = "triaged"
        if (vitals) enc.vitals.push({ ...vitals, id: uid("v"), at: nowIso(), by: d.session.userId })
        audit(d, `Triage ${regionOf(d) === "us" ? "ESI" : "MTS"} ${level}`, patientName(d, enc.patientId))
      })
    },

    addVitals(encounterId: string, vitals: Omit<Vitals, "id" | "at" | "by">) {
      set((d) => {
        const enc = findEncounter(d, encounterId)
        enc.vitals.push({ ...vitals, id: uid("v"), at: nowIso(), by: d.session.userId })
      })
    },

    addNote(encounterId: string, note: Pick<ClinicalNote, "subjective" | "objective" | "assessment" | "plan"> & { type?: ClinicalNote["type"] }) {
      set((d) => {
        const enc = findEncounter(d, encounterId)
        enc.notes.push({ ...note, id: uid("note"), at: nowIso(), authorId: d.session.userId, role: d.session.role })
        if (enc.status === "registered" || enc.status === "called" || enc.status === "triaged") {
          enc.status = "in-progress"
          enc.startedAt ??= nowIso()
        }
        audit(d, "Signed note", patientName(d, enc.patientId))
      })
    },

    verifyNote(encounterId: string, noteId: string) {
      set((d) => {
        const note = findEncounter(d, encounterId).notes.find((n) => n.id === noteId)
        if (note) note.verifiedBy = d.session.userId
      })
    },

    setDiagnoses(encounterId: string, diagnoses: Diagnosis[]) {
      set((d) => {
        findEncounter(d, encounterId).diagnoses = diagnoses
      })
    },

    setProcedures(encounterId: string, procedures: Procedure[]) {
      set((d) => {
        findEncounter(d, encounterId).procedures = procedures
      })
    },

    finishEncounter(encounterId: string, disposition: Disposition, note?: string) {
      set((d) => {
        const enc = findEncounter(d, encounterId)
        finishInternal(d, enc, disposition, note)
        audit(d, "Closed visit", `${patientName(d, enc.patientId)} — ${disposition}`)
      })
    },

    // -------------------------------------------------------------------------------------
    // Sepsis
    // -------------------------------------------------------------------------------------

    /** Starts the sepsis clock (time zero = now). */
    startSepsis(encounterId: string, septicShock: boolean) {
      set((d) => {
        const enc = findEncounter(d, encounterId)
        if (enc.sepsis) return
        enc.sepsis = { identifiedAt: nowIso(), identifiedBy: d.session.userId, septicShock, done: {} }
        notify(d, { level: "danger", title: regionOf(d) === "us" ? "Sepsis alert — SEP-1 clock started" : "Red flag sepsis — Sepsis Six started", body: patientName(d, enc.patientId), href: `/encounters/${enc.id}`, roles: ["doctor", "nurse"] })
        audit(d, "Sepsis identified", patientName(d, enc.patientId))
      })
    },

    toggleBundleItem(encounterId: string, itemId: string) {
      set((d) => {
        const sepsis = findEncounter(d, encounterId).sepsis
        if (!sepsis) return
        if (sepsis.done[itemId]) delete sepsis.done[itemId]
        else sepsis.done[itemId] = nowIso()
      })
    },

    // -------------------------------------------------------------------------------------
    // Inpatient (ADT)
    // -------------------------------------------------------------------------------------

    /** Admits a patient to a bed. `fromEncounterId` links the ED/clinic encounter. */
    admit(input: { patientId: string; bedId: string; practitionerId: string; reason: string; fromEncounterId?: string; admissionClass?: AdmissionClass; authNumber?: string; edd?: string }): string {
      const id = uid("enc")
      set((d) => {
        const bed = d.beds.find((b) => b.id === input.bedId)!
        const patient = d.patients.find((p) => p.id === input.patientId)!
        const parent = input.fromEncounterId ? findEncounter(d, input.fromEncounterId) : undefined
        const us = regionOf(d) === "us"
        const enc: Encounter = {
          id,
          kind: "inpatient",
          patientId: patient.id,
          unitId: bed.unitId,
          practitionerId: input.practitionerId,
          payer: parent?.payer ?? patient.payer,
          status: "in-progress",
          accountNumber: nextAccountNumber(d),
          createdAt: nowIso(),
          startedAt: nowIso(),
          chiefComplaint: input.reason,
          bedId: bed.id,
          admissionClass: us ? input.admissionClass ?? "inpatient" : undefined,
          authNumber: input.authNumber,
          eligibility: parent?.eligibility,
          diagnoses: parent ? parent.diagnoses.map((x) => ({ ...x, poa: us ? ("Y" as const) : undefined })) : [],
          procedures: [],
          notes: [],
          vitals: [],
          handovers: [],
          assessments: [],
          sepsis: parent?.sepsis,
          dischargePlan: { edd: input.edd ?? new Date(Date.now() + 4 * 86400000).toISOString(), barriers: [], medicallyReady: false, imNotice: us && patient.payer === "medicare" ? false : undefined },
          exchange: isOn(d, "interop") ? "pending" : "not-required",
          parentId: parent?.id,
        }
        d.encounters.push(enc)
        bed.status = "occupied"
        bed.encounterId = id
        addTariff(d, enc, "ip-initial")
        if (parent && parent.status !== "finished") {
          if (parent.kind === "emergency") addTariff(d, parent, edLevel(parent.triage))
          parent.status = "finished"
          parent.endedAt = nowIso()
          parent.disposition = "admit"
          createClaimIfNeeded(d, parent)
        }
        queueSync(d, "hl7v2", "ADT^A01", id)
        queueSync(d, "fhir", "Encounter", id)
        if (us && enc.admissionClass === "inpatient" && patient.payer === "commercial" && !input.authNumber)
          notify(d, { level: "warning", title: "Authorization needed", body: `${patient.name}: commercial inpatient admission without prior authorization — notify payer within 24 h.`, href: "/claims", roles: ["coder", "frontdesk"] })
        audit(d, us && enc.admissionClass === "observation" ? "Placed in observation" : "Admitted", `${patient.name} → ${bed.code}`)
      })
      return id
    },

    /** US: change observation ↔ inpatient (Two-Midnight Rule), with the physician order. */
    setAdmissionClass(encounterId: string, admissionClass: AdmissionClass) {
      set((d) => {
        const enc = findEncounter(d, encounterId)
        enc.admissionClass = admissionClass
        audit(d, admissionClass === "inpatient" ? "Converted observation to inpatient" : "Changed to observation", patientName(d, enc.patientId))
      })
    },

    transferBed(encounterId: string, bedId: string) {
      set((d) => {
        const enc = findEncounter(d, encounterId)
        const from = d.beds.find((b) => b.id === enc.bedId)
        const to = d.beds.find((b) => b.id === bedId)!
        if (from) {
          from.status = "cleaning"
          from.encounterId = undefined
        }
        to.status = "occupied"
        to.encounterId = enc.id
        enc.bedId = to.id
        enc.unitId = to.unitId
        queueSync(d, "hl7v2", "ADT^A02", enc.id)
        audit(d, "Transferred", `${patientName(d, enc.patientId)}: ${from?.code ?? "-"} → ${to.code}`)
      })
    },

    setDischargePlan(encounterId: string, patch: Partial<DischargePlan>) {
      set((d) => {
        const enc = findEncounter(d, encounterId)
        enc.dischargePlan = { edd: nowIso(), barriers: [], medicallyReady: false, ...enc.dischargePlan, ...patch }
      })
    },

    discharge(encounterId: string, disposition: Disposition, note?: string) {
      set((d) => {
        const enc = findEncounter(d, encounterId)
        const bed = d.beds.find((b) => b.id === enc.bedId)
        if (bed) {
          const start = new Date(enc.startedAt ?? enc.createdAt).getTime()
          const inv = d.invoices.find((i) => i.encounterId === enc.id)
          if (enc.admissionClass === "observation") {
            const hours = Math.max(1, Math.round((Date.now() - start) / 3600000))
            const billed = inv?.charges.filter((c) => c.ref === "observation").reduce((s, c) => s + c.qty, 0) ?? 0
            if (hours > billed) addTariff(d, enc, "observation", hours - billed)
          } else {
            const days = Math.max(1, Math.ceil((Date.now() - start) / 86400000))
            const billed = inv?.charges.filter((c) => c.category === "room").reduce((s, c) => s + c.qty, 0) ?? 0
            if (days > billed) addTariff(d, enc, `room-${bed.bedType}` as TariffKey, days - billed)
          }
          bed.status = "cleaning"
          bed.encounterId = undefined
        }
        finishInternal(d, enc, disposition, note)
        audit(d, "Discharged", `${patientName(d, enc.patientId)} — ${disposition}`)
      })
    },

    setBedStatus(bedId: string, status: BedStatus) {
      set((d) => {
        const bed = d.beds.find((b) => b.id === bedId)
        if (!bed || bed.status === "occupied") return
        bed.status = status
      })
    },

    // -------------------------------------------------------------------------------------
    // Nursing
    // -------------------------------------------------------------------------------------

    addHandover(encounterId: string, note: Omit<HandoverNote, "id" | "at" | "authorId">) {
      set((d) => {
        findEncounter(d, encounterId).handovers.push({ ...note, id: uid("ho"), at: nowIso(), authorId: d.session.userId })
      })
    },

    addAssessment(encounterId: string, kind: AssessmentKind, answers: Record<string, number>) {
      set((d) => {
        const enc = findEncounter(d, encounterId)
        const items = kind === "morse" ? MORSE_ITEMS : BRADEN_ITEMS
        const score = items.reduce((s, item) => s + (answers[item.id] ?? 0), 0)
        enc.assessments.push({ id: uid("as"), at: nowIso(), by: d.session.userId, kind, score, answers })
        if (kind === "morse") {
          const p = d.patients.find((x) => x.id === enc.patientId)!
          const flags = new Set(p.flags ?? [])
          if (score >= 45) flags.add("fall-risk")
          else flags.delete("fall-risk")
          p.flags = [...flags]
        }
        audit(d, kind === "morse" ? `Morse fall scale ${score}` : `Braden scale ${score}`, patientName(d, enc.patientId))
      })
    },

    /** Records an eMAR administration. BCMA: `scanned` means wristband and dose barcode matched. */
    recordMar(marId: string, status: MarStatus, note?: string, opts: { scanned?: boolean; witnessId?: string } = {}) {
      set((d) => {
        const m = d.mar.find((x) => x.id === marId)
        if (!m) return
        m.status = status
        m.by = d.session.userId
        m.at = nowIso()
        m.note = note
        m.scanned = status === "given" ? opts.scanned ?? false : undefined
        m.witnessId = opts.witnessId
        const item = d.inventory.find((i) => i.id === m.itemId)
        audit(d, status === "given" ? (opts.scanned ? "Administered (barcode scanned)" : "Administered (scan override)") : "Held / refused dose", `${item?.name ?? m.itemId} · ${patientName(d, findEncounter(d, m.encounterId).patientId)}`)
      })
    },
  }
}
