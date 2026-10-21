/**
 * Patient registry, registration, encounter documentation, inpatient flow and nursing.
 */
import type {
  Allergy, BedStatus, ClinicalNote, Diagnosis, Disposition, Encounter, EncounterKind, HandoverNote, MarStatus,
  Patient, PayerType, Procedure, TriageLevel, Vitals,
} from "@/domain/types"
import { uid } from "@/lib/id"
import { addTariff, audit, findEncounter, isOn, nextQueueNumber, notify, nowIso, patientName, queueSync, type Draft, type SetFn } from "../helpers"
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
  "poli-umum": "A", "poli-dalam": "B", "poli-anak": "C", "poli-obgyn": "D", "poli-bedah": "E", "poli-saraf": "F", "poli-gigi": "G", igd: "IGD-",
}

/** SEP format: kode faskes (4) + "R" + 3 + MMYY + "V" + 6-digit sequence (issued by V-Claim in production). */
function issueSepNumber(d: Draft): string {
  const now = new Date()
  const mmyy = `${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getFullYear()).slice(2)}`
  return `${d.facility.code.slice(0, 4)}R001${mmyy}V${String(Math.floor(Math.random() * 999999)).padStart(6, "0")}`
}

function finishInternal(d: Draft, enc: Encounter, disposition: Disposition, note?: string) {
  enc.disposition = disposition
  enc.dispositionNote = note
  if (disposition === "rawat-inap" && enc.kind !== "inpatient") {
    // The encounter stays open until a bed is assigned — admission staff work from this list.
    enc.status = "awaiting-admission"
    notify(d, { level: "info", title: "Permintaan rawat inap", body: `${patientName(d, enc.patientId)} menunggu tempat tidur.`, href: "/inpatient", roles: ["nurse", "frontdesk", "admin"] })
    return
  }
  enc.status = "finished"
  enc.endedAt = nowIso()
  if (enc.kind === "outpatient") addTariff(d, enc, enc.unitId === "poli-umum" || enc.unitId === "poli-gigi" ? "konsul-umum" : "konsul-spesialis")
  queueSync(d, "satusehat", "Encounter", enc.id)
  createClaimIfNeeded(d, enc)
}

export function clinicalActions(set: SetFn) {
  return {
    createPatient(input: NewPatient): string {
      const id = uid("pt")
      set((d) => {
        d.mrnCounter += 7
        d.patients.unshift({ ...input, id, mrn: String(d.mrnCounter).padStart(6, "0"), createdAt: nowIso() })
        audit(d, "Mendaftarkan pasien baru", input.name)
      })
      return id
    },

    updatePatient(id: string, patch: Partial<NewPatient>) {
      set((d) => {
        const p = d.patients.find((x) => x.id === id)
        if (!p) return
        Object.assign(p, patch)
        audit(d, "Mengubah data pasien", p.name)
      })
    },

    addAllergy(patientId: string, allergy: Allergy) {
      set((d) => {
        const p = d.patients.find((x) => x.id === patientId)
        if (!p) return
        p.allergies.push(allergy)
        audit(d, "Menambah alergi", `${p.name}: ${allergy.substance}`)
      })
    },

    removeAllergy(patientId: string, substance: string) {
      set((d) => {
        const p = d.patients.find((x) => x.id === patientId)
        if (!p) return
        p.allergies = p.allergies.filter((a) => a.substance !== substance)
        audit(d, "Menghapus alergi", `${p.name}: ${substance}`)
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
          queueNumber: nextQueueNumber(d, input.unitId, QUEUE_PREFIX[input.unitId] ?? "Z"),
          createdAt: nowIso(),
          chiefComplaint: input.complaint,
          referralNumber: input.referralNumber,
          sepNumber: input.payer === "bpjs" && isOn(d, "bpjs") ? issueSepNumber(d) : undefined,
          diagnoses: [],
          procedures: [],
          notes: [],
          vitals: [],
          handovers: [],
          satusehat: isOn(d, "satusehat") ? "pending" : "not-required",
        }
        d.encounters.push(enc)
        addTariff(d, enc, "admin")
        if (input.kind === "emergency") addTariff(d, enc, "igd")
        if (enc.sepNumber) queueSync(d, "bpjs-vclaim", "SEP", enc.id)
        if (input.kind === "outpatient") queueSync(d, "bpjs-antrean", "Antrean", enc.id)
        if (input.appointmentId) {
          const ap = d.appointments.find((a) => a.id === input.appointmentId)
          if (ap) {
            ap.status = "checked-in"
            ap.encounterId = id
          }
        }
        audit(d, input.kind === "emergency" ? "Mendaftarkan pasien IGD" : "Mendaftarkan kunjungan", `${patient.name} · ${enc.queueNumber}`)
      })
      return id
    },

    issueSep(encounterId: string) {
      set((d) => {
        const enc = findEncounter(d, encounterId)
        enc.sepNumber = issueSepNumber(d)
        queueSync(d, "bpjs-vclaim", "SEP", enc.id)
        audit(d, "Menerbitkan SEP", enc.sepNumber)
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
        audit(d, "Membatalkan kunjungan", `${patientName(d, enc.patientId)} — ${reason}`)
      })
    },

    callPatient(encounterId: string) {
      set((d) => {
        const enc = findEncounter(d, encounterId)
        enc.status = "called"
        enc.calledAt = nowIso()
        queueSync(d, "bpjs-antrean", "Task 4 (panggil)", enc.id)
      })
    },

    startEncounter(encounterId: string) {
      set((d) => {
        const enc = findEncounter(d, encounterId)
        if (enc.status === "finished" || enc.status === "cancelled") return
        enc.status = "in-progress"
        enc.startedAt ??= nowIso()
        enc.practitionerId ??= d.session.role === "doctor" ? d.session.userId : enc.practitionerId
        audit(d, "Membuka rekam medis", patientName(d, enc.patientId))
      })
    },

    triage(encounterId: string, level: TriageLevel, vitals?: Omit<Vitals, "id" | "at" | "by">) {
      set((d) => {
        const enc = findEncounter(d, encounterId)
        enc.triage = level
        if (enc.status === "registered") enc.status = "triaged"
        if (vitals) enc.vitals.push({ ...vitals, id: uid("v"), at: nowIso(), by: d.session.userId })
        audit(d, `Triase level ${level}`, patientName(d, enc.patientId))
      })
    },

    addVitals(encounterId: string, vitals: Omit<Vitals, "id" | "at" | "by">) {
      set((d) => {
        const enc = findEncounter(d, encounterId)
        enc.vitals.push({ ...vitals, id: uid("v"), at: nowIso(), by: d.session.userId })
      })
    },

    addNote(encounterId: string, note: Pick<ClinicalNote, "subjective" | "objective" | "assessment" | "plan">) {
      set((d) => {
        const enc = findEncounter(d, encounterId)
        enc.notes.push({ ...note, id: uid("cppt"), at: nowIso(), authorId: d.session.userId, role: d.session.role })
        if (enc.status === "registered" || enc.status === "called" || enc.status === "triaged") {
          enc.status = "in-progress"
          enc.startedAt ??= nowIso()
        }
        audit(d, "Menulis CPPT", patientName(d, enc.patientId))
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
        audit(d, "Menyelesaikan kunjungan", `${patientName(d, enc.patientId)} — ${disposition}`)
      })
    },

    // -------------------------------------------------------------------------------------
    // Inpatient
    // -------------------------------------------------------------------------------------

    /** Admits a patient to a bed. `fromEncounterId` links the ER/outpatient encounter. */
    admit(input: { patientId: string; bedId: string; practitionerId: string; reason: string; fromEncounterId?: string }): string {
      const id = uid("enc")
      set((d) => {
        const bed = d.beds.find((b) => b.id === input.bedId)!
        const patient = d.patients.find((p) => p.id === input.patientId)!
        const parent = input.fromEncounterId ? findEncounter(d, input.fromEncounterId) : undefined
        const enc: Encounter = {
          id,
          kind: "inpatient",
          patientId: patient.id,
          unitId: bed.unitId,
          practitionerId: input.practitionerId,
          payer: parent?.payer ?? patient.payer,
          status: "in-progress",
          createdAt: nowIso(),
          startedAt: nowIso(),
          chiefComplaint: input.reason,
          bedId: bed.id,
          sepNumber: parent?.sepNumber,
          diagnoses: parent ? [...parent.diagnoses] : [],
          procedures: [],
          notes: [],
          vitals: [],
          handovers: [],
          satusehat: isOn(d, "satusehat") ? "pending" : "not-required",
          parentId: parent?.id,
        }
        d.encounters.push(enc)
        bed.status = "occupied"
        bed.encounterId = id
        if (parent && parent.status !== "finished") {
          parent.status = "finished"
          parent.endedAt = nowIso()
          parent.disposition = "rawat-inap"
          queueSync(d, "satusehat", "Encounter", parent.id)
        }
        queueSync(d, "satusehat", "Encounter", id)
        audit(d, "Admisi rawat inap", `${patient.name} → ${bed.code}`)
      })
      return id
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
        audit(d, "Pindah ruang", `${patientName(d, enc.patientId)}: ${from?.code ?? "-"} → ${to.code}`)
      })
    },

    discharge(encounterId: string, disposition: Disposition, note?: string) {
      set((d) => {
        const enc = findEncounter(d, encounterId)
        const bed = d.beds.find((b) => b.id === enc.bedId)
        if (bed) {
          const days = Math.max(1, Math.ceil((Date.now() - new Date(enc.startedAt ?? enc.createdAt).getTime()) / 86400000))
          const billed = d.invoices.find((i) => i.encounterId === enc.id)?.charges.filter((c) => c.category === "kamar").reduce((s, c) => s + c.qty, 0) ?? 0
          if (days > billed) addTariff(d, enc, `kamar-${bed.bedClass}` as "kamar-KRIS", days - billed)
          bed.status = "cleaning"
          bed.encounterId = undefined
        }
        finishInternal(d, enc, disposition, note)
        audit(d, "Pasien pulang", `${patientName(d, enc.patientId)} — ${disposition}`)
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

    recordMar(marId: string, status: MarStatus, note?: string) {
      set((d) => {
        const m = d.mar.find((x) => x.id === marId)
        if (!m) return
        m.status = status
        m.by = d.session.userId
        m.at = nowIso()
        m.note = note
        const item = d.inventory.find((i) => i.id === m.itemId)
        audit(d, status === "given" ? "Memberikan obat" : "Menunda/menolak obat", `${item?.name ?? m.itemId} · ${patientName(d, findEncounter(d, m.encounterId).patientId)}`)
      })
    },
  }
}
