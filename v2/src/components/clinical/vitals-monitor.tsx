/**
 * Vital signs rendered like a bedside monitor: dark panel, parameter colours that match the
 * monitors on the ward (HR green, SpO₂ cyan, NIBP red, RR yellow, temperature orange), and a
 * trend line per parameter. Out-of-range values get an inverted tile, not a blink.
 *
 * Temperatures are stored in °C and shown in the facility's unit (°F in the US). Abnormal
 * thresholds follow the NEWS2 single-parameter red bands (RCP, 2017).
 */
import { AlertTriangle } from "lucide-react"
import { news2 } from "@v2/domain/clinical"
import type { Vitals } from "@v2/domain/types"
import { cn } from "@v2/lib/cn"
import { formatTime, tempUnit, toDisplayTemp } from "@v2/lib/format"

interface Param {
  key: keyof Vitals
  label: string
  /** Unit as a function so temperature follows the facility region. */
  unit: () => string
  /** Converts the stored value for display (°C → °F for US facilities). */
  show?: (v: number) => number
  color: string
  stroke: string
  abnormal: (v: number) => boolean
}

const PARAMS: Param[] = [
  { key: "heartRate", label: "HR", unit: () => "bpm", color: "text-mon-hr", stroke: "var(--color-mon-hr)", abnormal: (v) => v > 110 || v < 50 },
  { key: "spo2", label: "SpO₂", unit: () => "%", color: "text-mon-spo2", stroke: "var(--color-mon-spo2)", abnormal: (v) => v < 94 },
  { key: "systolic", label: "NIBP", unit: () => "mmHg", color: "text-mon-bp", stroke: "var(--color-mon-bp)", abnormal: (v) => v >= 160 || v <= 90 },
  { key: "respRate", label: "RR", unit: () => "/min", color: "text-mon-rr", stroke: "var(--color-mon-rr)", abnormal: (v) => v > 24 || v < 10 },
  { key: "temperature", label: "TEMP", unit: tempUnit, show: toDisplayTemp, color: "text-mon-temp", stroke: "var(--color-mon-temp)", abnormal: (v) => v >= 38.5 || v < 35.5 },
]

function Sparkline({ values, stroke }: { values: number[]; stroke: string }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / span) * 24 - 2}`).join(" ")
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="absolute inset-x-3 bottom-2 h-6 w-[calc(100%-1.5rem)] opacity-50" aria-hidden>
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

interface VitalsMonitorProps {
  vitals?: Vitals
  /** Older readings (any order) for trend lines. */
  history?: Vitals[]
  /** Bed or location shown in the monitor's title bar. */
  label?: string
  compact?: boolean
}

export function VitalsMonitor({ vitals, history = [], label, compact }: VitalsMonitorProps) {
  const series = [...history].sort((a, b) => a.at.localeCompare(b.at))
  const score = vitals ? news2(vitals) : null
  const scoreTone = !score ? "bg-white/10 text-mon-text" : score.risk === "high" ? "bg-mon-bp text-black" : score.risk === "medium" ? "bg-mon-rr text-black" : "bg-mon-hr/90 text-black"

  return (
    <div className="@container overflow-hidden rounded-xl bg-monitor text-mon-text ring-1 ring-black/20">
      <div className="flex items-center justify-between gap-2 border-b border-monitor-line px-3 py-2">
        <span className="label-caps flex items-center gap-2 text-mon-text/70">
          <span className="pulse-dot size-1.5 rounded-full bg-mon-hr" aria-hidden />
          Monitor{label ? ` · ${label}` : ""}
        </span>
        <span className="num text-[11px] text-mon-text/60">{vitals ? formatTime(vitals.at) : "—"}</span>
      </div>
      {!vitals ? (
        <p className="px-3 py-6 text-center text-sm text-mon-text/60">No vital signs recorded yet.</p>
      ) : (
        <>
          <div className={cn("grid grid-cols-2 gap-px bg-monitor-line @md:grid-cols-3", !compact && "@3xl:grid-cols-6")}>
            {PARAMS.map((p) => {
              const raw = vitals[p.key] as number | undefined
              const bad = raw !== undefined && p.abnormal(raw)
              const values = series.map((s) => s[p.key] as number | undefined).filter((v): v is number => v !== undefined)
              return (
                <div key={p.key} className={cn("relative min-h-24 bg-monitor px-3 pb-8 pt-2", bad && "bg-[oklch(0.25_0.06_25)]")}>
                  <div className="flex items-center justify-between">
                    <span className={cn("label-caps", p.color)}>{p.label}</span>
                    {bad && <AlertTriangle className={cn("size-3.5", p.color)} aria-label="Out of range" />}
                  </div>
                  <div className={cn("num mt-1 font-semibold leading-none", p.color, compact ? "text-2xl" : "text-[28px]")}>
                    {raw === undefined ? "—" : p.key === "systolic" ? `${raw}/${vitals.diastolic ?? "–"}` : p.show ? p.show(raw) : raw}
                  </div>
                  <div className="num mt-0.5 text-[10px] text-mon-text/50">{p.unit()}</div>
                  <Sparkline values={values} stroke={p.stroke} />
                </div>
              )
            })}
            {/* Sixth tile: the aggregate early-warning score and what the protocol asks for. */}
            <div className="relative min-h-24 bg-monitor px-3 pb-3 pt-2">
              <span className="label-caps text-mon-text/70" title="National Early Warning Score 2 (Royal College of Physicians)">NEWS2</span>
              <div className="mt-1 flex items-end gap-2">
                <span className={cn("num rounded-md px-2 py-0.5 text-[26px] font-bold leading-none", scoreTone)}>{score ? score.score : "—"}</span>
                {score && <span className="label-caps pb-1 text-mon-text/60">{score.risk} risk</span>}
              </div>
              {score && <p className="mt-1.5 text-[11px] leading-snug text-mon-text/70">{score.response}</p>}
            </div>
          </div>
          {(vitals.onOxygen || (vitals.consciousness && vitals.consciousness !== "A") || vitals.painScore !== undefined) && (
            <div className="num flex flex-wrap items-center gap-3 border-t border-monitor-line px-3 py-2 text-[11px]">
              {vitals.onOxygen && <span className="text-mon-spo2">Supplemental O₂</span>}
              {vitals.consciousness && vitals.consciousness !== "A" && <span className="font-bold text-mon-bp">ACVPU {vitals.consciousness}</span>}
              {vitals.painScore !== undefined && <span className="text-mon-text/70">Pain {vitals.painScore}/10</span>}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** One-line monitor readout for dense cards (nursing station, worklists). */
export function VitalsStrip({ vitals }: { vitals?: Vitals }) {
  if (!vitals) return <div className="num rounded-lg bg-monitor px-3 py-2 text-xs text-mon-text/60">No vital signs recorded</div>
  const item = (label: string, value: string | number | undefined, color: string, bad?: boolean) =>
    value === undefined ? null : (
      <span className={cn("whitespace-nowrap", color, bad && "rounded bg-white/10 px-1")}>
        <span className="opacity-60">{label} </span>
        <b>{value}</b>
      </span>
    )
  return (
    <div className="num flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-monitor px-3 py-2 text-xs">
      {item("HR", vitals.heartRate, "text-mon-hr", PARAMS[0].abnormal(vitals.heartRate ?? 80))}
      {item("SpO₂", vitals.spo2, "text-mon-spo2", PARAMS[1].abnormal(vitals.spo2 ?? 98))}
      {item("BP", vitals.systolic !== undefined ? `${vitals.systolic}/${vitals.diastolic ?? "–"}` : undefined, "text-mon-bp", PARAMS[2].abnormal(vitals.systolic ?? 120))}
      {item("RR", vitals.respRate, "text-mon-rr", PARAMS[3].abnormal(vitals.respRate ?? 16))}
      {item("T", vitals.temperature !== undefined ? `${toDisplayTemp(vitals.temperature)}${tempUnit()}` : undefined, "text-mon-temp", PARAMS[4].abnormal(vitals.temperature ?? 37))}
    </div>
  )
}
