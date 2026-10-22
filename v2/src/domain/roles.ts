import type { RoleId } from "./types"

export interface RoleInfo {
  id: RoleId
  label: string
  /** What this person mostly does all day — shown on the role picker. */
  description: string
}

export const ROLES: Record<RoleId, RoleInfo> = {
  admin: { id: "admin", label: "System administrator", description: "Modules, users, access and facility configuration" },
  doctor: { id: "doctor", label: "Physician", description: "Sees patients, writes notes, orders tests and medications" },
  nurse: { id: "nurse", label: "Registered nurse", description: "Vitals, medication administration, assessments & handover" },
  frontdesk: { id: "frontdesk", label: "Patient access", description: "Registration, eligibility, queue and scheduling" },
  pharmacist: { id: "pharmacist", label: "Pharmacist", description: "Order verification, dispensing and controlled drugs" },
  labtech: { id: "labtech", label: "Medical lab scientist", description: "Specimens, results, verification and critical calls" },
  radiographer: { id: "radiographer", label: "Radiologic technologist", description: "Imaging exams and reports" },
  cashier: { id: "cashier", label: "Patient financial services", description: "Accounts, payments and statements" },
  coder: { id: "coder", label: "HIM / clinical coder", description: "Coding, grouping, claims and denials" },
  manager: { id: "manager", label: "Executive", description: "Throughput, quality and financial performance" },
}

export const ROLE_ORDER: RoleId[] = ["frontdesk", "doctor", "nurse", "pharmacist", "labtech", "radiographer", "cashier", "coder", "manager", "admin"]
