/**
 * Lab & imaging orders from inside the encounter (FHIR ServiceRequest), plus results as they
 * arrive. Labs are ordered by panel — the way they are drawn and billed (one CPT per panel,
 * one tube colour per specimen) — and imaging by exam with its CPT and revenue code.
 */
import { Button, Chip, ToggleButton } from "@heroui/react"
import { FlaskConical, ScanLine } from "lucide-react"
import { useMemo, useState } from "react"
import { OrderStatusChip, PriorityChip } from "@v2/components/status"
import { SelectInput, TextInput } from "@v2/components/ui/fields"
import { Panel } from "@v2/components/ui/panel"
import { LAB_MAP, LAB_PANELS, PANEL_MAP, RAD_EXAMS, RAD_MAP, orderTitle, panelTests } from "@v2/domain/catalog"
import type { AuthStatus, Encounter, OrderKind, Priority } from "@v2/domain/types"
import { formatDateTime, formatMoney } from "@v2/lib/format"
import { toast } from "@v2/lib/toast"
import { useActions, useStore } from "@v2/store"
import { useModuleEnabled, useRegion } from "@v2/store/selectors"
import { OrderResults } from "./clinical-widgets"

const AUTH: Record<AuthStatus, { label: string; color: "default" | "warning" | "success" | "danger" }> = {
  "not-required": { label: "No auth required", color: "default" },
  pending: { label: "Prior auth pending", color: "warning" },
  approved: { label: "Prior auth approved", color: "success" },
  denied: { label: "Prior auth denied", color: "danger" },
}

export function OrdersSection({ encounter, readOnly }: { encounter: Encounter; readOnly: boolean }) {
  const labOn = useModuleEnabled("laboratory")
  const radOn = useModuleEnabled("radiology")
  const allOrders = useStore((s) => s.orders)
  const orders = useMemo(() => allOrders.filter((o) => o.encounterId === encounter.id).sort((a, b) => b.orderedAt.localeCompare(a.orderedAt)), [allOrders, encounter.id])

  return (
    <div className="space-y-4">
      {!readOnly && labOn && <OrderForm encounter={encounter} kind="lab" />}
      {!readOnly && radOn && <OrderForm encounter={encounter} kind="rad" />}
      {orders.map((o) => {
        const codes = (o.kind === "lab" ? [...new Set(o.testCodes.map((c) => LAB_MAP[c]?.panel))].map((p) => (p ? PANEL_MAP[p]?.cpt : undefined)) : o.testCodes.map((c) => RAD_MAP[c]?.cpt)).filter(Boolean)
        return (
          <Panel
            key={o.id}
            title={
              <span className="flex items-center gap-2">
                {o.kind === "lab" ? <FlaskConical className="size-4 text-muted" aria-hidden /> : <ScanLine className="size-4 text-muted" aria-hidden />}
                {orderTitle(o)}
                {codes.length > 0 && <span className="num text-[11px] font-normal text-muted">CPT {codes.join(", ")}</span>}
              </span>
            }
            description={`Ordered ${formatDateTime(o.orderedAt)}${o.resultedAt ? ` · resulted ${formatDateTime(o.resultedAt)}` : ""}${o.clinicalNote ? ` · ${o.clinicalNote}` : ""}`}
            actions={
              <div className="flex flex-wrap justify-end gap-1.5">
                {o.auth && o.auth !== "not-required" && (
                  <Chip size="sm" variant="soft" color={AUTH[o.auth].color}>
                    {AUTH[o.auth].label}
                  </Chip>
                )}
                <PriorityChip priority={o.priority} />
                <OrderStatusChip status={o.status} />
              </div>
            }
          >
            <OrderResults order={o} />
          </Panel>
        )
      })}
      {orders.length === 0 && (readOnly || (!labOn && !radOn)) && <p className="text-sm text-muted">No lab or imaging orders.</p>}
    </div>
  )
}

interface CatalogEntry {
  code: string
  name: string
  group: string
  price: number
  cpt: string
  meta: string
  badges: { label: string; color: "warning" | "accent" }[]
}

function OrderForm({ encounter, kind }: { encounter: Encounter; kind: OrderKind }) {
  const { placeOrder } = useActions()
  const region = useRegion()
  const patient = useStore((s) => s.patients.find((p) => p.id === encounter.patientId))
  const [selected, setSelected] = useState<string[]>([])
  const [priority, setPriority] = useState<Priority>(encounter.kind === "emergency" ? "stat" : "routine")
  const [note, setNote] = useState(encounter.diagnoses.find((d) => d.primary)?.display ?? encounter.chiefComplaint)

  const catalog: CatalogEntry[] = useMemo(
    () =>
      kind === "lab"
        ? LAB_PANELS.map((p) => ({
            code: p.code,
            name: p.name,
            group: "Panels & tests",
            price: p.price[region],
            cpt: p.cpt,
            meta: `${p.code} · CPT ${p.cpt}${p.loinc ? ` · LOINC ${p.loinc}` : ""}`,
            badges: [{ label: p.tube, color: "accent" as const }],
          }))
        : RAD_EXAMS.map((e) => ({
            code: e.code,
            name: e.name,
            group: e.modality === "XR" ? "Radiography" : e.modality === "US" ? "Ultrasound" : e.modality === "CT" ? "CT" : e.modality === "MR" ? "MRI" : "Echocardiography",
            price: e.price[region],
            cpt: e.cpt,
            meta: `CPT ${e.cpt} · rev ${e.revCode}`,
            badges: [
              ...(e.priorAuth && region === "us" ? [{ label: "Prior auth", color: "warning" as const }] : []),
              ...(e.pregnancyCheck ? [{ label: "Pregnancy status required", color: "accent" as const }] : []),
            ],
          })),
    [kind, region],
  )
  const groups = [...new Set(catalog.map((c) => c.group))]
  const chosen = catalog.filter((c) => selected.includes(c.code))
  const total = chosen.reduce((s, c) => s + c.price, 0)
  const toggle = (code: string) => setSelected((s) => (s.includes(code) ? s.filter((c) => c !== code) : [...s, code]))
  const needsPregnancy = kind === "rad" && patient?.gender === "female" && selected.some((c) => RAD_MAP[c]?.pregnancyCheck)
  const needsAuth = kind === "rad" && region === "us" && encounter.kind === "outpatient" && selected.some((c) => RAD_MAP[c]?.priorAuth)

  return (
    <Panel
      title={kind === "lab" ? "Order labs" : "Order imaging"}
      description={kind === "lab" ? "Select panels; the specimen tube and CPT are shown for each. Charges post to the account automatically." : "Select exams; charges post to the account automatically."}
    >
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g}>
            <div className="label-caps mb-1.5 text-muted">{g}</div>
            <div className="flex flex-wrap gap-1.5">
              {catalog
                .filter((c) => c.group === g)
                .map((c) => (
                  <ToggleButton key={c.code} size="sm" isSelected={selected.includes(c.code)} onChange={() => toggle(c.code)} aria-label={`${c.name} (${c.meta})`}>
                    {kind === "lab" && <span className="num font-bold">{c.code}</span>}
                    {c.name}
                    {kind === "rad" && <span className="num text-[11px] opacity-70">{c.cpt}</span>}
                  </ToggleButton>
                ))}
            </div>
          </div>
        ))}
        {chosen.length > 0 && (
          <ul className="space-y-1 rounded-xl bg-surface-secondary px-3 py-2 text-sm">
            {chosen.map((c) => (
              <li key={c.code} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{c.name}</span>
                <span className="num text-[11px] text-muted">{c.meta}</span>
                {kind === "lab" && <span className="num text-[11px] text-muted">· {panelTests(c.code).length} analyte(s)</span>}
                {c.badges.map((b) => (
                  <Chip key={b.label} size="sm" variant="soft" color={b.color}>
                    {b.label}
                  </Chip>
                ))}
                <span className="tabular ml-auto text-xs text-muted">{formatMoney(c.price)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <SelectInput
            label="Priority"
            value={priority}
            onChange={setPriority}
            options={[
              { value: "routine", label: "Routine" },
              { value: "stat", label: "STAT" },
            ]}
          />
          <TextInput label={kind === "lab" ? "Clinical indication" : "Reason for exam"} value={note} onChange={setNote} />
        </div>
        {needsPregnancy && <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-soft-foreground">Document pregnancy status (hCG or LMP) before ionizing radiation or contrast.</p>}
        {needsAuth && (encounter.payer === "commercial" || patient?.coverage?.plan?.includes("Advantage")) && (
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-soft-foreground">Advanced outpatient imaging for this payer needs prior authorization (X12 278). The order will be held as “Prior auth pending”.</p>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted">
            {selected.length ? (
              <>
                {selected.length} {kind === "lab" ? "panel(s)" : "exam(s)"} · <span className="tabular">{formatMoney(total)}</span>
              </>
            ) : (
              "Nothing selected"
            )}
          </span>
          <Button
            variant="primary"
            isDisabled={!selected.length}
            onPress={() => {
              const testCodes = kind === "lab" ? selected.flatMap((p) => panelTests(p)) : selected
              placeOrder({ encounterId: encounter.id, kind, testCodes, priority, clinicalNote: note })
              toast.success(`${kind === "lab" ? "Lab" : "Imaging"} order sent`, { description: `${selected.join(", ")}${priority === "stat" ? " · STAT" : ""}` })
              setSelected([])
            }}
          >
            Sign & send
          </Button>
        </div>
        {priority === "stat" && (
          <Chip size="sm" color="danger" variant="soft">
            The {kind === "lab" ? "lab" : "imaging"} team is notified immediately
          </Chip>
        )}
      </div>
    </Panel>
  )
}
