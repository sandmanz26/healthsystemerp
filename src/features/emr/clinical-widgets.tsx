/**
 * Small clinical display components shared by EMR, nursing, ED and patient pages.
 */
import { Chip } from "@heroui/react"
import { VitalsMonitor } from "@/components/clinical/vitals-monitor"
import { FlagChip } from "@/components/status"
import { LAB_MAP, RAD_MAP, loincFor } from "@/domain/catalog"
import { news2, rangeLabel } from "@/domain/clinical"
import type { ServiceOrder, Vitals } from "@/domain/types"
import { cn } from "@/lib/cn"
import { useRegion } from "@/store/selectors"

export function News2Chip({ vitals }: { vitals?: Vitals }) {
  const score = vitals ? news2(vitals) : null
  if (!score)
    return (
      <Chip size="sm" variant="soft" className="num whitespace-nowrap">
        NEWS2 —
      </Chip>
    )
  const color = score.risk === "high" ? "danger" : score.risk === "medium" ? "warning" : "success"
  return (
    <Chip size="sm" color={color} variant={score.risk === "low" ? "soft" : "primary"} title={score.response} className="num whitespace-nowrap">
      NEWS2 {score.score}
      {score.redFlag && score.risk !== "high" ? " ⚑" : ""}
    </Chip>
  )
}

/** Latest vital signs on the bedside-monitor display, with trends when history is given. */
export function VitalsGrid({ vitals, history, label, compact }: { vitals?: Vitals; history?: Vitals[]; label?: string; compact?: boolean }) {
  return <VitalsMonitor vitals={vitals} history={history} label={label} compact={compact} />
}

/** Results of one order. Lab: table with LOINC, reference ranges and flags. Imaging: the report. */
export function OrderResults({ order }: { order: ServiceOrder }) {
  const region = useRegion()
  if (order.kind === "rad") {
    const cpts = order.testCodes.map((c) => RAD_MAP[c]?.cpt).filter(Boolean)
    return order.report ? (
      <div>
        <p className="whitespace-pre-line text-sm">{order.report}</p>
        {cpts.length > 0 && <p className="label-caps mt-2 text-muted">CPT {cpts.join(", ")}</p>}
      </div>
    ) : (
      <p className="text-sm text-muted">Report not yet available.</p>
    )
  }
  if (!order.results.length) return <p className="text-sm text-muted">Results pending.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="py-1 font-medium">Test</th>
            <th className="py-1 font-medium">Result</th>
            <th className="py-1 font-medium">Reference range</th>
            <th className="py-1 font-medium">Flag</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-separator">
          {order.results.map((r) => {
            const t = LAB_MAP[r.testCode]
            return (
              <tr key={r.testCode}>
                <td className="py-1.5">
                  {t?.name ?? r.testCode}
                  {t && <span className="num ml-2 text-[11px] text-muted">LOINC {loincFor(t, region)}</span>}
                </td>
                <td className={cn("tabular py-1.5 font-semibold", r.flag !== "N" && "text-danger")}>
                  {r.value} <span className="text-xs font-normal text-muted">{r.unit}</span>
                </td>
                <td className="tabular py-1.5 text-muted">{rangeLabel(r.testCode, region) || "—"}</td>
                <td className="py-1.5">
                  <FlagChip flag={r.flag} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {order.criticalCall && (
        <p className="mt-2 text-xs text-muted">
          Critical value called to {order.criticalCall.to} with read-back.
        </p>
      )}
    </div>
  )
}
