/**
 * Scheduling, HR roster, surgery, quality and integrations.
 */
import type { Appointment, Incident, ShiftCode, Surgery, SurgeryStatus } from "@/domain/types"
import { riskGrade } from "@/domain/quality"
import { uid } from "@/lib/id"
import { addTariff, audit, findEncounter, notify, nowIso, patientName, type SetFn } from "../helpers"

const NEXT_SURGERY_STATUS: Partial<Record<SurgeryStatus, SurgeryStatus>> = {
  scheduled: "sign-in",
  "sign-in": "time-out",
  "time-out": "sign-out",
  "sign-out": "done",
}

export function operationsActions(set: SetFn) {
  return {
    bookAppointment(input: Omit<Appointment, "id" | "status">): string {
      const id = uid("ap")
      set((d) => {
        d.appointments.push({ ...input, id, status: "booked" })
        audit(d, "Membuat janji temu", `${patientName(d, input.patientId)} · ${input.time}`)
      })
      return id
    },

    setAppointmentStatus(id: string, status: Appointment["status"]) {
      set((d) => {
        const ap = d.appointments.find((a) => a.id === id)
        if (ap) ap.status = status
      })
    },

    setShift(staffId: string, date: string, shift: ShiftCode) {
      set((d) => {
        const entry = d.roster.find((r) => r.staffId === staffId && r.date === date)
        if (entry) entry.shift = shift
        else d.roster.push({ staffId, date, shift })
      })
    },

    scheduleSurgery(input: Omit<Surgery, "id" | "status" | "checklist">): string {
      const id = uid("op")
      set((d) => {
        d.surgeries.push({ ...input, id, status: "scheduled", checklist: {} })
        audit(d, "Menjadwalkan operasi", `${patientName(d, input.patientId)}: ${input.procedure}`)
      })
      return id
    },

    toggleChecklist(surgeryId: string, itemId: string) {
      set((d) => {
        const s = d.surgeries.find((x) => x.id === surgeryId)
        if (s) s.checklist[itemId] = !s.checklist[itemId]
      })
    },

    advanceSurgery(surgeryId: string) {
      set((d) => {
        const s = d.surgeries.find((x) => x.id === surgeryId)
        if (!s) return
        const next = NEXT_SURGERY_STATUS[s.status]
        if (!next) return
        s.status = next
        if (next === "done" && s.encounterId) addTariff(d, findEncounter(d, s.encounterId), "operasi")
        audit(d, `Operasi: ${next}`, `${patientName(d, s.patientId)} · ${s.procedure}`)
      })
    },

    cancelSurgery(surgeryId: string) {
      set((d) => {
        const s = d.surgeries.find((x) => x.id === surgeryId)
        if (s) s.status = "cancelled"
      })
    },

    reportIncident(input: Omit<Incident, "id" | "reportedAt" | "grade" | "status">): string {
      const id = uid("ikp")
      set((d) => {
        const grade = riskGrade(input.probability, input.impact)
        d.incidents.unshift({ ...input, id, reportedAt: nowIso(), grade, status: "dilaporkan" })
        if (grade === "merah" || input.type === "Sentinel")
          notify(d, { level: "danger", title: `Insiden ${input.type} grade ${grade}`, body: "Wajib RCA & lapor direksi.", href: "/quality", roles: ["manager", "admin"] })
        audit(d, "Melaporkan insiden", input.type)
      })
      return id
    },

    setIncidentStatus(id: string, status: Incident["status"]) {
      set((d) => {
        const i = d.incidents.find((x) => x.id === id)
        if (i) i.status = status
      })
    },

    /** Simulated retry: most jobs succeed, a few keep failing so the UI shows both paths. */
    retrySync(jobId: string) {
      set((d) => {
        const job = d.syncJobs.find((j) => j.id === jobId)
        if (!job || job.status === "synced") return
        job.attempts += 1
        job.at = nowIso()
        const ok = Math.random() > 0.2
        job.status = ok ? "synced" : "failed"
        job.error = ok ? undefined : job.error ?? "HTTP 503 dari server tujuan"
        if (job.resource === "Encounter") {
          const enc = d.encounters.find((e) => e.id === job.ref)
          if (enc) enc.satusehat = job.status
        }
      })
    },

    /** Flushes pending jobs (in production this is a background worker). */
    processPendingSync() {
      set((d) => {
        for (const job of d.syncJobs) {
          if (job.status !== "pending") continue
          job.status = "synced"
          job.attempts += 1
          job.at = nowIso()
          const enc = job.resource === "Encounter" ? d.encounters.find((e) => e.id === job.ref) : undefined
          if (enc) enc.satusehat = "synced"
        }
      })
    },
  }
}
