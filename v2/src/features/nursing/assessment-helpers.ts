/** Morse / Braden scale definitions and helpers shared by the nursing screens. */
import { BRADEN_ITEMS, MORSE_ITEMS, bradenRisk, morseRisk } from "@v2/domain/clinical"
import type { Assessment, AssessmentKind, Encounter } from "@v2/domain/types"

export const SCALE = {
  morse: { name: "Morse Fall Scale", items: MORSE_ITEMS, source: "Morse JM, 1989 · range 0–125", risk: morseRisk },
  braden: { name: "Braden Scale", items: BRADEN_ITEMS, source: "Bergstrom N, Braden B, 1987 · range 6–23", risk: bradenRisk },
} as const

/** Danger / warning / success tone for a risk level. */
export function riskTone(kind: AssessmentKind, score: number): "danger" | "warning" | "success" {
  if (kind === "morse") {
    const l = morseRisk(score).level
    return l === "high" ? "danger" : l === "moderate" ? "warning" : "success"
  }
  const l = bradenRisk(score).level
  return l === "very-high" || l === "high" ? "danger" : l === "moderate" || l === "mild" ? "warning" : "success"
}

export const LEVEL_LABEL: Record<string, string> = { high: "High risk", moderate: "Moderate risk", low: "Low risk", "very-high": "Very high risk", mild: "At risk", none: "No risk" }

export function latestAssessment(e: Encounter, kind: AssessmentKind): Assessment | undefined {
  return e.assessments.filter((a) => a.kind === kind).sort((a, b) => b.at.localeCompare(a.at))[0]
}
