/**
 * Small clinical display components shared by EMR, nursing, ER and patient pages.
 */
import { Chip } from "@heroui/react"
import { FlagChip } from "@/components/status"
import { LAB_MAP } from "@/domain/catalog"
import { news2 } from "@/domain/clinical"
import type { ServiceOrder, Vitals } from "@/domain/types"
import { cn } from "@/lib/cn"
import { formatDateTime } from "@/lib/format"

export function News2Chip({ vitals }: { vitals?: Vitals }) {
  const score = vitals ? news2(vitals) : null
  if (!score)
    return (
      <Chip size="sm" variant="soft" className="whitespace-nowrap">
        NEWS2 —
      </Chip>
    )
  const color = score.risk === "tinggi" ? "danger" : score.risk === "sedang" ? "warning" : "success"
  return (
    <Chip size="sm" color={color} variant={score.risk === "rendah" ? "soft" : "primary"} title={score.response} className="whitespace-nowrap">
      NEWS2 {score.score}
      {score.redFlag && score.risk !== "tinggi" ? " ⚑" : ""}
    </Chip>
  )
}

const VITAL_FIELDS: { key: keyof Vitals; label: string; unit: string; abnormal?: (v: number) => boolean }[] = [
  { key: "systolic", label: "TD", unit: "mmHg", abnormal: (v) => v >= 160 || v <= 90 },
  { key: "heartRate", label: "Nadi", unit: "x/mnt", abnormal: (v) => v > 110 || v < 50 },
  { key: "respRate", label: "Napas", unit: "x/mnt", abnormal: (v) => v > 24 || v < 10 },
  { key: "temperature", label: "Suhu", unit: "°C", abnormal: (v) => v >= 38.5 || v < 35.5 },
  { key: "spo2", label: "SpO₂", unit: "%", abnormal: (v) => v < 94 },
  { key: "painScore", label: "Nyeri", unit: "/10", abnormal: (v) => v >= 7 },
]

/** Latest vital signs as a compact grid; abnormal values are bold red with a ▲/▼-free label. */
export function VitalsGrid({ vitals }: { vitals?: Vitals }) {
  if (!vitals) return <p className="text-sm text-muted">Belum ada tanda vital.</p>
  return (
    <div className="@container">
      <div className="grid grid-cols-3 gap-2 @xl:grid-cols-6">
        {VITAL_FIELDS.map((f) => {
          const raw = vitals[f.key] as number | undefined
          const value = f.key === "systolic" && raw !== undefined ? `${raw}/${vitals.diastolic ?? "-"}` : raw
          const bad = raw !== undefined && f.abnormal?.(raw)
          return (
            <div key={f.key} className={cn("rounded-xl bg-surface-secondary px-3 py-2", bad && "bg-danger-soft")}>
              <div className="text-[11px] text-muted">{f.label}</div>
              <div className={cn("tabular text-sm font-semibold", bad && "text-danger")}>
                {value ?? "—"}
                {value !== undefined && <span className="ml-0.5 text-[10px] font-normal text-muted">{f.unit}</span>}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted">
        <News2Chip vitals={vitals} />
        <span>{formatDateTime(vitals.at)}</span>
        {vitals.onOxygen && <span>· dengan O₂</span>}
        {vitals.consciousness && vitals.consciousness !== "A" && <span className="font-semibold text-danger">· Kesadaran {vitals.consciousness}</span>}
      </div>
    </div>
  )
}

/** Results of one order. Lab: table with reference ranges and flags. Radiology: the report. */
export function OrderResults({ order }: { order: ServiceOrder }) {
  if (order.kind === "rad") {
    return order.report ? <p className="whitespace-pre-line text-sm">{order.report}</p> : <p className="text-sm text-muted">Ekspertise belum tersedia.</p>
  }
  if (!order.results.length) return <p className="text-sm text-muted">Hasil belum tersedia.</p>
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-muted">
          <th className="py-1 font-medium">Pemeriksaan</th>
          <th className="py-1 font-medium">Hasil</th>
          <th className="py-1 font-medium">Nilai rujukan</th>
          <th className="py-1 font-medium">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-separator">
        {order.results.map((r) => {
          const t = LAB_MAP[r.testCode]
          return (
            <tr key={r.testCode}>
              <td className="py-1.5">{t?.name ?? r.testCode}</td>
              <td className={cn("tabular py-1.5 font-semibold", r.flag !== "N" && "text-danger")}>
                {r.value} <span className="text-xs font-normal text-muted">{t?.unit}</span>
              </td>
              <td className="tabular py-1.5 text-muted">{t?.low !== undefined && t?.high !== undefined ? `${t.low}–${t.high}` : "—"}</td>
              <td className="py-1.5">
                <FlagChip flag={r.flag} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
