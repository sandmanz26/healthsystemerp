/**
 * Nursing shifts: 12-hour day (07:00–19:00) and night (19:00–07:00) — the dominant pattern in
 * US and UK acute wards. Everything a ward does is organised around the current shift, so the
 * app shows it permanently.
 */
export type ShiftCode = "D" | "N"

export interface ShiftInfo {
  code: ShiftCode
  label: string
  start: string
  end: string
  /** 0..1 of the shift elapsed. */
  progress: number
  remainingMin: number
}

const SHIFTS: { code: ShiftCode; label: string; from: number; to: number }[] = [
  { code: "D", label: "Day", from: 7, to: 19 },
  { code: "N", label: "Night", from: 19, to: 31 },
]

export function shiftAt(now: Date | number = new Date()): ShiftInfo {
  const d = new Date(now)
  let h = d.getHours() + d.getMinutes() / 60
  if (h < 7) h += 24
  const s = SHIFTS.find((x) => h >= x.from && h < x.to)!
  const length = s.to - s.from
  return {
    code: s.code,
    label: s.label,
    start: `${String(s.from % 24).padStart(2, "0")}:00`,
    end: `${String(s.to % 24).padStart(2, "0")}:00`,
    progress: (h - s.from) / length,
    remainingMin: Math.round((s.to - h) * 60),
  }
}
