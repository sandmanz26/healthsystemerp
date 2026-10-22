import type { Vitals } from "@v2/domain/types"
import { currentRegion, fromDisplayTemp } from "@v2/lib/format"

/** Vital-sign inputs as typed (strings), before parsing. Temperature and weight are in display units. */
export type VitalsDraft = Record<"systolic" | "diastolic" | "heartRate" | "respRate" | "temperature" | "spo2" | "painScore" | "weight", string>

const num = (v: string) => (v.trim() === "" ? undefined : Number(v.replace(",", ".")))

/** Weight is typed in lb on US charts and stored in kg. */
export const weightUnit = () => (currentRegion() === "us" ? "lb" : "kg")
const fromDisplayWeight = (v: number) => (currentRegion() === "us" ? Math.round((v / 2.20462) * 10) / 10 : v)

/** Parses the draft into stored units (°C, kg). */
export function toVitals(d: VitalsDraft, onOxygen: boolean, consciousness: Vitals["consciousness"]): Omit<Vitals, "id" | "at" | "by"> {
  const temp = num(d.temperature)
  const weight = num(d.weight)
  return {
    systolic: num(d.systolic),
    diastolic: num(d.diastolic),
    heartRate: num(d.heartRate),
    respRate: num(d.respRate),
    temperature: temp === undefined || Number.isNaN(temp) ? undefined : fromDisplayTemp(temp),
    spo2: num(d.spo2),
    painScore: num(d.painScore),
    weight: weight === undefined || Number.isNaN(weight) ? undefined : fromDisplayWeight(weight),
    onOxygen,
    consciousness,
  }
}

export const EMPTY_VITALS: VitalsDraft = { systolic: "", diastolic: "", heartRate: "", respRate: "", temperature: "", spo2: "", painScore: "", weight: "" }
