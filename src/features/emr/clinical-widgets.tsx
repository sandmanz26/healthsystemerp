/**
 * Small clinical display components shared by EMR, nursing, ER and patient pages.
 */
import { Chip } from "@heroui/react"
import { VitalsMonitor } from "@/components/clinical/vitals-monitor"
import { FlagChip } from "@/components/status"
import { LAB_MAP } from "@/domain/catalog"
import { news2 } from "@/domain/clinical"
import type { ServiceOrder, Vitals } from "@/domain/types"
import { cn } from "@/lib/cn"

export function News2Chip({ vitals }: { vitals?: Vitals }) {
  const score = vitals ? news2(vitals) : null
  if (!score)
    return (
      <Chip size="sm" variant="soft" className="num whitespace-nowrap">
        NEWS2 —
      </Chip>
    )
  const color = score.risk === "tinggi" ? "danger" : score.risk === "sedang" ? "warning" : "success"
  return (
    <Chip size="sm" color={color} variant={score.risk === "rendah" ? "soft" : "primary"} title={score.response} className="num whitespace-nowrap">
      NEWS2 {score.score}
      {score.redFlag && score.risk !== "tinggi" ? " ⚑" : ""}
    </Chip>
  )
}

/** Latest vital signs on the bedside-monitor display, with trends when history is given. */
export function VitalsGrid({ vitals, history, label, compact }: { vitals?: Vitals; history?: Vitals[]; label?: string; compact?: boolean }) {
  return <VitalsMonitor vitals={vitals} history={history} label={label} compact={compact} />
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
