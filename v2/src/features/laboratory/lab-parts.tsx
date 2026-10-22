/**
 * Laboratory building blocks: specimen tubes, result entry/review with reference ranges in
 * the region's unit system, and the critical-value call-back record.
 */
import { Button, Checkbox, Label } from "@heroui/react"
import { AlertOctagon, PhoneCall } from "lucide-react"
import { useState } from "react"
import { FlagChip } from "@v2/components/status"
import { TextInput } from "@v2/components/ui/fields"
import { LAB_MAP, loincFor, rangeFor } from "@v2/domain/catalog"
import { flagResult, isCritical, rangeLabel } from "@v2/domain/clinical"
import type { Region } from "@v2/domain/region"
import type { ServiceOrder } from "@v2/domain/types"
import { cn } from "@v2/lib/cn"
import { formatTime } from "@v2/lib/format"
import { toast } from "@v2/lib/toast"
import { useActions } from "@v2/store"
import { orderPanels, tubeColour } from "./lab-utils"

/** A code with its system, e.g. "LOINC 2524-7" — muted mono, never louder than the data. */
export function Code({ system, code, className }: { system: string; code: string; className?: string }) {
  return (
    <span className={cn("num whitespace-nowrap text-[11px] text-muted", className)}>
      {system} {code}
    </span>
  )
}

export function TubeDot({ tube }: { tube: string }) {
  return <span className="inline-block size-3 shrink-0 rounded-full border border-black/15" style={{ background: tubeColour(tube) }} aria-hidden />
}

/** Tubes to draw for one order — what the phlebotomist labels at the bedside. */
export function SpecimenList({ order }: { order: ServiceOrder }) {
  return (
    <ul className="divide-y divide-separator rounded-xl border border-border">
      {orderPanels(order).map((p) => (
        <li key={p.code} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
          <TubeDot tube={p.tube} />
          <span className="font-medium">{p.name}</span>
          <span className="text-muted">{p.tube}</span>
          <span className="ml-auto flex gap-3">
            {p.loinc && <Code system="LOINC" code={p.loinc} />}
            <Code system="CPT" code={p.cpt} />
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Result entry: one field per analyte, in the region's units, with a live flag preview. */
export function LabResultEntry({ order, region, values, onChange }: { order: ServiceOrder; region: Region; values: Record<string, string>; onChange: (code: string, value: string) => void }) {
  return (
    <div className="space-y-3">
      {order.testCodes.map((code) => {
        const t = LAB_MAP[code]
        if (!t) return null
        const range = rangeFor(t, region)
        const v = values[code] ?? ""
        const flag = flagResult(code, v, region)
        return (
          <div key={code} className="grid grid-cols-[1fr_auto] items-end gap-3">
            <TextInput
              label={t.name}
              value={v}
              onChange={(next) => onChange(code, next)}
              inputMode={t.normalText ? "text" : "decimal"}
              placeholder={t.normalText}
              suffix={range?.unit || undefined}
              description={
                <span className="num text-[11px]">
                  Ref {rangeLabel(code, region) || "—"} · LOINC {loincFor(t, region)}
                </span>
              }
            />
            <div className="pb-6">{v.trim() && <FlagChip flag={flag} />}</div>
          </div>
        )
      })}
    </div>
  )
}

/** Resulted values as printed on a lab report. */
export function LabResultTable({ order, region }: { order: ServiceOrder; region: Region }) {
  if (!order.results.length) return <p className="text-sm text-muted">No results yet.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[460px] text-sm">
        <thead>
          <tr className="label-caps border-b border-separator text-left text-muted">
            <th className="py-1.5 pr-2 font-semibold">Test</th>
            <th className="py-1.5 pr-2 font-semibold">Result</th>
            <th className="py-1.5 pr-2 font-semibold">Reference</th>
            <th className="py-1.5 font-semibold">Flag</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-separator">
          {order.results.map((r) => {
            const t = LAB_MAP[r.testCode]
            return (
              <tr key={r.testCode}>
                <td className="py-1.5 pr-2">
                  <div>{t?.name ?? r.testCode}</div>
                  {t && <Code system="LOINC" code={loincFor(t, region)} />}
                </td>
                <td className={cn("num py-1.5 pr-2 font-semibold", r.flag !== "N" && "text-danger")}>
                  {r.value} <span className="text-xs font-normal text-muted">{r.unit}</span>
                </td>
                <td className="num py-1.5 pr-2 text-xs text-muted">{rangeLabel(r.testCode, region) || "—"}</td>
                <td className="py-1.5">
                  <FlagChip flag={r.flag} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Critical (panic) value call-back. The result must be phoned to a licensed caregiver who reads
 * it back; verification stays blocked until the call is documented.
 */
export function CriticalCallForm({ order, region, staffName, defaultTo }: { order: ServiceOrder; region: Region; staffName: (id: string) => string; defaultTo?: string }) {
  const { recordCriticalCall } = useActions()
  const [to, setTo] = useState(defaultTo ?? "")
  const [readBack, setReadBack] = useState(false)
  const critical = order.results.filter((r) => isCritical(r.flag))
  if (!critical.length) return null
  const source = region === "us" ? "Joint Commission NPSG.02.03.01" : "RCPath critical results guidance"

  if (order.criticalCall)
    return (
      <div className="flex items-start gap-2 rounded-xl border border-border bg-surface-secondary p-3 text-sm">
        <PhoneCall className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
        <div>
          <div>
            Called by <b>{staffName(order.criticalCall.by)}</b> at <span className="num">{formatTime(order.criticalCall.at)}</span> to <b>{order.criticalCall.to}</b> — read-back confirmed.
          </div>
          <div className="label-caps mt-1 text-muted">{source}</div>
        </div>
      </div>
    )

  return (
    <div className="space-y-3 rounded-xl bg-danger-soft p-3 text-sm text-danger-soft-foreground">
      <div className="flex items-center gap-2 font-semibold">
        <AlertOctagon className="size-4" aria-hidden /> Critical value — call-back required
      </div>
      <ul className="num space-y-0.5 text-xs">
        {critical.map((r) => (
          <li key={r.testCode}>
            {LAB_MAP[r.testCode]?.name ?? r.testCode}: {r.value} {r.unit} ({r.flag}) · ref {rangeLabel(r.testCode, region)}
          </li>
        ))}
      </ul>
      <p>Phone the result to the responsible {region === "us" ? "provider or RN" : "clinician"} and have them read it back before verifying.</p>
      <TextInput label="Called to (name, role)" value={to} onChange={setTo} placeholder={region === "us" ? "e.g. Dr. Patel, hospitalist" : "e.g. Dr Patel, FY2 on call"} />
      <Checkbox isSelected={readBack} onChange={setReadBack}>
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Label className="text-sm">Read-back confirmed</Label>
        </Checkbox.Content>
      </Checkbox>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label-caps opacity-80">{source}</span>
        <Button
          size="sm"
          variant="danger"
          isDisabled={!to.trim() || !readBack}
          onPress={() => {
            recordCriticalCall(order.id, to.trim())
            toast.success("Critical value call documented")
          }}
        >
          <PhoneCall className="size-3.5" aria-hidden /> Document call
        </Button>
      </div>
    </div>
  )
}
