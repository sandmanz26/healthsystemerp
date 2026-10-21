import type { Vitals } from "@/domain/types"

/** Vital-sign inputs as typed (strings), before parsing. */
export type VitalsDraft = Record<"systolic" | "diastolic" | "heartRate" | "respRate" | "temperature" | "spo2" | "painScore" | "weight", string>

const num = (v: string) => (v.trim() === "" ? undefined : Number(v.replace(",", ".")))

export function toVitals(d: VitalsDraft, onOxygen: boolean, consciousness: Vitals["consciousness"]): Omit<Vitals, "id" | "at" | "by"> {
  return {
    systolic: num(d.systolic),
    diastolic: num(d.diastolic),
    heartRate: num(d.heartRate),
    respRate: num(d.respRate),
    temperature: num(d.temperature),
    spo2: num(d.spo2),
    painScore: num(d.painScore),
    weight: num(d.weight),
    onOxygen,
    consciousness,
  }
}

export const EMPTY_VITALS: VitalsDraft = { systolic: "", diastolic: "", heartRate: "", respRate: "", temperature: "", spo2: "", painScore: "", weight: "" }
