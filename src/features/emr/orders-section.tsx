/**
 * Lab & radiology ordering from inside the encounter, plus results as they arrive.
 * Tests are toggle chips grouped by panel: faster than a dropdown for the 5–10 tests a
 * clinician orders most.
 */
import { Button, Chip, ToggleButton } from "@heroui/react"
import { FlaskConical, ScanLine } from "lucide-react"
import { useMemo, useState } from "react"
import { OrderStatusChip, PriorityChip } from "@/components/status"
import { SelectInput, TextInput } from "@/components/ui/fields"
import { Panel } from "@/components/ui/panel"
import { LAB_TESTS, RAD_EXAMS, orderTitle } from "@/domain/catalog"
import type { Encounter, OrderKind, Priority } from "@/domain/types"
import { formatDateTime, formatRupiah } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useActions, useStore } from "@/store"
import { useModuleEnabled } from "@/store/selectors"
import { OrderResults } from "./clinical-widgets"

export function OrdersSection({ encounter, readOnly }: { encounter: Encounter; readOnly: boolean }) {
  const labOn = useModuleEnabled("laboratory")
  const radOn = useModuleEnabled("radiology")
  const allOrders = useStore((s) => s.orders)
  const orders = useMemo(() => allOrders.filter((o) => o.encounterId === encounter.id).sort((a, b) => b.orderedAt.localeCompare(a.orderedAt)), [allOrders, encounter.id])

  return (
    <div className="space-y-4">
      {!readOnly && labOn && <OrderForm encounter={encounter} kind="lab" />}
      {!readOnly && radOn && <OrderForm encounter={encounter} kind="rad" />}
      {orders.map((o) => (
        <Panel
          key={o.id}
          title={
            <span className="flex items-center gap-2">
              {o.kind === "lab" ? <FlaskConical className="size-4 text-muted" aria-hidden /> : <ScanLine className="size-4 text-muted" aria-hidden />}
              {orderTitle(o)}
            </span>
          }
          description={`Diorder ${formatDateTime(o.orderedAt)}${o.resultedAt ? ` · hasil ${formatDateTime(o.resultedAt)}` : ""}`}
          actions={
            <div className="flex gap-1.5">
              <PriorityChip priority={o.priority} />
              <OrderStatusChip status={o.status} />
            </div>
          }
        >
          <OrderResults order={o} />
        </Panel>
      ))}
      {orders.length === 0 && (readOnly || (!labOn && !radOn)) && <p className="text-sm text-muted">Tidak ada order penunjang.</p>}
    </div>
  )
}

function OrderForm({ encounter, kind }: { encounter: Encounter; kind: OrderKind }) {
  const { placeOrder } = useActions()
  const [selected, setSelected] = useState<string[]>([])
  const [priority, setPriority] = useState<Priority>(encounter.kind === "emergency" ? "cito" : "rutin")
  const [note, setNote] = useState(encounter.diagnoses.find((d) => d.primary)?.display ?? encounter.chiefComplaint)
  const catalog = kind === "lab" ? LAB_TESTS.map((t) => ({ code: t.code, name: t.name, group: t.panel, price: t.price })) : RAD_EXAMS.map((t) => ({ code: t.code, name: t.name, group: t.modality, price: t.price }))
  const groups = [...new Set(catalog.map((c) => c.group))]
  const total = catalog.filter((c) => selected.includes(c.code)).reduce((s, c) => s + c.price, 0)
  const toggle = (code: string) => setSelected((s) => (s.includes(code) ? s.filter((c) => c !== code) : [...s, code]))

  return (
    <Panel title={kind === "lab" ? "Order laboratorium" : "Order radiologi"} description="Pilih pemeriksaan, lalu kirim. Tarif otomatis masuk tagihan.">
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g}>
            <div className="mb-1.5 text-xs font-semibold text-muted">{g}</div>
            <div className="flex flex-wrap gap-1.5">
              {catalog
                .filter((c) => c.group === g)
                .map((c) => (
                  <ToggleButton key={c.code} size="sm" isSelected={selected.includes(c.code)} onChange={() => toggle(c.code)}>
                    {c.name}
                  </ToggleButton>
                ))}
            </div>
          </div>
        ))}
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <SelectInput
            label="Prioritas"
            value={priority}
            onChange={setPriority}
            options={[
              { value: "rutin", label: "Rutin" },
              { value: "cito", label: "CITO (segera)" },
            ]}
          />
          <TextInput label="Keterangan klinis" value={note} onChange={setNote} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted">
            {selected.length ? (
              <>
                {selected.length} pemeriksaan · <span className="tabular">{formatRupiah(total)}</span>
              </>
            ) : (
              "Belum ada pemeriksaan dipilih"
            )}
          </span>
          <Button
            variant="primary"
            isDisabled={!selected.length}
            onPress={() => {
              placeOrder({ encounterId: encounter.id, kind, testCodes: selected, priority, clinicalNote: note })
              toast.success(`Order ${kind === "lab" ? "lab" : "radiologi"} terkirim`, { description: `${selected.length} pemeriksaan${priority === "cito" ? " · CITO" : ""}` })
              setSelected([])
            }}
          >
            Kirim order
          </Button>
        </div>
        {priority === "cito" && (
          <Chip size="sm" color="danger" variant="soft">
            Petugas {kind === "lab" ? "laboratorium" : "radiologi"} akan menerima notifikasi segera
          </Chip>
        )}
      </div>
    </Panel>
  )
}
