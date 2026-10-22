/**
 * Supply chain: stock by lot and expiry (FEFO), par levels and purchase requisitions.
 * "New requisition" pre-fills every item below par — the order people usually assemble by
 * hand from a spreadsheet. Items carry their WHO ATC code and the package barcode scanned at
 * receiving and at the bedside (NDC in the US, GS1 GTIN in the UK).
 */
import { Button, Chip, ProgressBar, Tabs } from "@heroui/react"
import { AlertTriangle, Boxes, CalendarX, PackagePlus, Wallet } from "lucide-react"
import { useMemo, useState } from "react"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Dialog } from "@/components/ui/dialog"
import { Empty } from "@/components/ui/empty"
import { SelectInput, TextInput } from "@/components/ui/fields"
import { Page, PageHeader } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import { Segmented } from "@/components/ui/segmented"
import { Stat } from "@/components/ui/stat"
import type { InventoryItem, PurchaseRequest, PurchaseStatus } from "@/domain/types"
import { cn } from "@/lib/cn"
import { formatDate, formatDateTime, formatMoney } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useNow } from "@/lib/use-now"
import { useActions, useStore } from "@/store"
import { stockOf, useInventoryMap, useRegion, useSession, useStaffMap } from "@/store/selectors"
import { DrugBadges } from "@/features/pharmacy/drug-badges"

const DAY = 86400000
type Category = InventoryItem["category"] | "all"
const CATEGORY_LABEL: Record<InventoryItem["category"], string> = { drug: "Drugs", supply: "Medical supplies", reagent: "Lab reagents", general: "General" }
const PR_STATUS: Record<PurchaseStatus, { label: string; color: "default" | "accent" | "success" | "danger" | "warning" }> = {
  draft: { label: "Draft", color: "default" },
  submitted: { label: "Awaiting approval", color: "warning" },
  approved: { label: "Approved", color: "accent" },
  received: { label: "Received", color: "success" },
  rejected: { label: "Rejected", color: "danger" },
}

export default function InventoryPage() {
  const inventory = useStore((s) => s.inventory)
  const purchases = useStore((s) => s.purchases)
  const movements = useStore((s) => s.movements)
  const items = useInventoryMap()
  const staff = useStaffMap()
  const { role } = useSession()
  const { setPurchaseStatus, adjustStock } = useActions()
  const region = useRegion()
  const [category, setCategory] = useState<Category>("all")
  const [requesting, setRequesting] = useState(false)
  const [adjusting, setAdjusting] = useState<InventoryItem>()
  const now = useNow()

  const low = inventory.filter((i) => stockOf(i) < i.minStock)
  const batches = useMemo(() => inventory.flatMap((i) => i.batches.map((b) => ({ item: i, ...b }))).sort((a, b) => a.expiry.localeCompare(b.expiry)), [inventory])
  const expired = batches.filter((b) => new Date(b.expiry).getTime() < now)
  const expiring = batches.filter((b) => new Date(b.expiry).getTime() >= now && new Date(b.expiry).getTime() < now + 90 * DAY)
  const value = inventory.reduce((s, i) => s + stockOf(i) * i.price, 0)
  const rows = inventory.filter((i) => category === "all" || i.category === category)

  const columns: Column<InventoryItem>[] = [
    {
      id: "name",
      header: "Item",
      isRowHeader: true,
      sortValue: (i) => i.name,
      cell: (i) => (
        <div>
          <div className="flex flex-wrap items-center gap-1.5 font-medium">
            {i.name}
            <DrugBadges item={i} region={region} />
          </div>
          <div className="text-xs text-muted">{CATEGORY_LABEL[i.category]}{i.form ? ` · ${i.form}` : ""}</div>
        </div>
      ),
    },
    {
      id: "codes",
      header: region === "us" ? "ATC / NDC" : "ATC / GTIN",
      cell: (i) => (
        <div className="num text-[11px] leading-relaxed text-muted">
          <div>{i.atc ? `ATC ${i.atc}` : "—"}</div>
          {i.barcode && <div>{region === "us" ? "NDC" : "GTIN"} {i.barcode}</div>}
        </div>
      ),
    },
    {
      id: "stock",
      header: "On hand / par",
      sortValue: (i) => stockOf(i) / i.minStock,
      cell: (i) => {
        const s = stockOf(i)
        const ratio = Math.min(100, (s / (i.minStock * 2)) * 100)
        return (
          <div className="w-40">
            <div className={cn("num text-sm", s < i.minStock && "font-semibold text-danger")}>
              {s} / {i.minStock} {i.unit}
            </div>
            <ProgressBar value={ratio} aria-label={`Stock level ${i.name}`} color={s < i.minStock ? "danger" : "success"} size="sm">
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
          </div>
        )
      },
    },
    {
      id: "expiry",
      header: "Next lot · expiry",
      sortValue: (i) => [...i.batches].sort((a, b) => a.expiry.localeCompare(b.expiry))[0]?.expiry ?? "9",
      cell: (i) => {
        const b = [...i.batches].sort((a, b) => a.expiry.localeCompare(b.expiry))[0]
        if (!b) return <span className="text-muted">—</span>
        const soon = new Date(b.expiry).getTime() < now + 90 * DAY
        return (
          <div className="num text-sm">
            <div className="text-xs text-muted">Lot {b.batch}</div>
            <span className={cn(soon && "font-semibold text-warning")}>{formatDate(b.expiry)}</span>
          </div>
        )
      },
    },
    { id: "price", header: "Unit cost", align: "end", cell: (i) => <span className="num text-sm">{formatMoney(i.price)}</span> },
    {
      id: "actions",
      header: "",
      align: "end",
      cell: (i) => (
        <Button size="sm" variant="ghost" onPress={() => setAdjusting(i)}>
          Count
        </Button>
      ),
    },
  ]

  const canApprove = role === "manager" || role === "admin"

  return (
    <Page>
      <PageHeader
        title="Supply Chain"
        description="Stock by lot with FEFO issue (first expiry, first out), par levels and requisitions."
        actions={
          <Button variant="primary" onPress={() => setRequesting(true)}>
            <PackagePlus className="size-4" aria-hidden /> New requisition
          </Button>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Below par level" value={low.length} icon={AlertTriangle} tone={low.length ? "danger" : "success"} />
        <Stat label="Expiring ≤ 90 days" value={expiring.length} icon={CalendarX} tone={expiring.length ? "warning" : "default"} hint={expired.length ? `${expired.length} lot(s) already expired` : undefined} />
        <Stat label="Items stocked" value={inventory.length} icon={Boxes} />
        <Stat label="Inventory value" value={formatMoney(value)} icon={Wallet} tone="accent" />
      </div>

      <Tabs>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Supply chain">
            <Tabs.Tab className="whitespace-nowrap" id="stock">Stock<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab className="whitespace-nowrap" id="expiry">Expiry ({expiring.length + expired.length})<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab className="whitespace-nowrap" id="purchase">Requisitions ({purchases.filter((p) => p.status === "submitted").length})<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab className="whitespace-nowrap" id="movement">Transactions<Tabs.Indicator /></Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="stock" className="pt-4">
          <Panel flush>
            <div className="border-b border-separator p-4">
              <Segmented label="Category" value={category} onChange={setCategory} options={[{ value: "all", label: "All" }, ...(Object.keys(CATEGORY_LABEL) as InventoryItem["category"][]).map((c) => ({ value: c, label: CATEGORY_LABEL[c], count: inventory.filter((i) => i.category === c).length }))]} />
            </div>
            <DataTable label="Stock" rows={rows} columns={columns} rowKey={(i) => i.id} defaultSort={{ column: "stock", direction: "ascending" }} />
          </Panel>
        </Tabs.Panel>

        <Tabs.Panel id="expiry" className="pt-4">
          <Panel flush>
            {expired.length + expiring.length === 0 ? (
              <Empty title="No lots expiring within 90 days" />
            ) : (
              <ul className="divide-y divide-separator">
                {[...expired, ...expiring].map((b) => {
                  const isExpired = new Date(b.expiry).getTime() < now
                  return (
                    <li key={`${b.item.id}-${b.batch}`} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{b.item.name}</div>
                        <div className="num text-xs text-muted">
                          Lot {b.batch} · {b.qty} {b.item.unit} · {formatMoney(b.qty * b.item.price)}
                        </div>
                      </div>
                      <Chip size="sm" color={isExpired ? "danger" : "warning"} variant="soft">
                        {isExpired ? "Expired" : "Exp"} {formatDate(b.expiry)}
                      </Chip>
                      {isExpired && (
                        <Button size="sm" variant="danger-soft" onPress={() => { adjustStock(b.item.id, -b.qty, "expire", b.batch); toast("Lot quarantined for destruction and logged") }}>
                          Remove from stock
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
        </Tabs.Panel>

        <Tabs.Panel id="purchase" className="space-y-3 pt-4">
          {purchases.length === 0 && <Panel><Empty title="No requisitions yet" /></Panel>}
          {purchases.map((p) => (
            <PurchaseCard key={p.id} pr={p} canApprove={canApprove} onStatus={(s) => { setPurchaseStatus(p.id, s); toast.success(`Requisition ${PR_STATUS[s].label.toLowerCase()}`, { description: s === "received" ? "Stock received as a new lot." : undefined }) }} items={items} staffName={(id) => staff.get(id)?.name ?? id} />
          ))}
        </Tabs.Panel>

        <Tabs.Panel id="movement" className="pt-4">
          <Panel flush>
            <ul className="divide-y divide-separator">
              {movements.slice(0, 60).map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <span className="num w-36 shrink-0 text-muted">{formatDateTime(m.at)}</span>
                  <span className="flex-1">{items.get(m.itemId)?.name}</span>
                  <span className="text-xs text-muted">{{ dispense: "Dispensed", receive: "Received", adjust: "Cycle count", expire: "Expired / wasted" }[m.reason]}</span>
                  <span className={cn("num w-16 text-right font-semibold", m.qty < 0 ? "text-danger" : "text-success")}>
                    {m.qty > 0 ? "+" : ""}
                    {m.qty}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </Tabs.Panel>
      </Tabs>

      {requesting && <PurchaseDialog onClose={() => setRequesting(false)} />}
      {adjusting && <AdjustDialog item={adjusting} onClose={() => setAdjusting(undefined)} />}
    </Page>
  )
}

function PurchaseCard({ pr, canApprove, onStatus, items, staffName }: { pr: PurchaseRequest; canApprove: boolean; onStatus: (s: PurchaseStatus) => void; items: Map<string, InventoryItem>; staffName: (id: string) => string }) {
  const total = pr.lines.reduce((s, l) => s + (items.get(l.itemId)?.price ?? 0) * l.qty, 0)
  return (
    <Panel
      title={`Requisition ${formatDate(pr.createdAt)}`}
      description={`${staffName(pr.createdBy)}${pr.note ? ` · ${pr.note}` : ""}`}
      actions={
        <Chip size="sm" variant="soft" color={PR_STATUS[pr.status].color}>
          {PR_STATUS[pr.status].label}
        </Chip>
      }
    >
      <ul className="space-y-1 text-sm">
        {pr.lines.map((l) => (
          <li key={l.itemId} className="flex justify-between">
            <span>{items.get(l.itemId)?.name}</span>
            <span className="num">
              {l.qty} {items.get(l.itemId)?.unit}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-separator pt-3">
        <span className="num text-sm">Estimated {formatMoney(total)}</span>
        <div className="flex gap-2">
          {pr.status === "submitted" && canApprove && (
            <>
              <Button size="sm" variant="ghost" onPress={() => onStatus("rejected")}>
                Reject
              </Button>
              <Button size="sm" variant="primary" onPress={() => onStatus("approved")}>
                Approve
              </Button>
            </>
          )}
          {pr.status === "submitted" && !canApprove && <span className="text-xs text-muted">Awaiting management approval</span>}
          {pr.status === "approved" && (
            <Button size="sm" variant="primary" onPress={() => onStatus("received")}>
              Receive goods
            </Button>
          )}
        </div>
      </div>
    </Panel>
  )
}

function PurchaseDialog({ onClose }: { onClose: () => void }) {
  const inventory = useStore((s) => s.inventory)
  const { createPurchase } = useActions()
  const [lines, setLines] = useState(() => inventory.filter((i) => stockOf(i) < i.minStock).map((i) => ({ itemId: i.id, qty: String(i.minStock * 2 - stockOf(i)) })))
  const [note, setNote] = useState("")
  const [adding, setAdding] = useState<string | null>(null)
  const map = useInventoryMap()
  return (
    <Dialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      isDismissable={false}
      title="Purchase requisition"
      description="Items below par are pre-filled with a quantity that brings them to 2× par."
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isDisabled={!lines.some((l) => Number(l.qty) > 0)}
            onPress={() => {
              createPurchase(lines.filter((l) => Number(l.qty) > 0).map((l) => ({ itemId: l.itemId, qty: Number(l.qty) })), note || undefined)
              toast.success("Requisition submitted", { description: "Awaiting management approval." })
              onClose()
            }}
          >
            Submit
          </Button>
        </>
      }
    >
      <ul className="space-y-2">
        {lines.map((l, i) => (
          <li key={l.itemId} className="grid grid-cols-[1fr_120px_auto] items-end gap-2">
            <div className="pb-2 text-sm">
              <div className="font-medium">{map.get(l.itemId)?.name}</div>
              <div className="text-xs text-muted">
                on hand {stockOf(map.get(l.itemId)!)} / par {map.get(l.itemId)?.minStock}
              </div>
            </div>
            <TextInput label="Quantity" value={l.qty} onChange={(v) => setLines((ls) => ls.map((x, idx) => (idx === i ? { ...x, qty: v.replace(/\D/g, "") } : x)))} inputMode="numeric" />
            <Button variant="ghost" size="sm" onPress={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <SelectInput
        label="Add item"
        value={adding}
        onChange={(v) => {
          setLines((ls) => (ls.some((l) => l.itemId === v) ? ls : [...ls, { itemId: v, qty: String(map.get(v)?.minStock ?? 1) }]))
          setAdding(null)
        }}
        options={inventory.filter((i) => !lines.some((l) => l.itemId === i.id)).map((i) => ({ value: i.id, label: i.name }))}
        placeholder="Select item…"
      />
      <TextInput label="Note" value={note} onChange={setNote} />
    </Dialog>
  )
}

function AdjustDialog({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const { adjustStock } = useActions()
  const [counted, setCounted] = useState(String(stockOf(item)))
  const diff = Number(counted) - stockOf(item)
  return (
    <Dialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title="Cycle count"
      description={item.name}
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isDisabled={diff === 0 || counted === ""}
            onPress={() => {
              adjustStock(item.id, diff, "adjust")
              toast.success("Stock adjusted", { description: `${diff > 0 ? "+" : ""}${diff} ${item.unit}` })
              onClose()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <TextInput label="Physical count" value={counted} onChange={(v) => setCounted(v.replace(/\D/g, ""))} inputMode="numeric" suffix={item.unit} description={`System: ${stockOf(item)} ${item.unit}${diff ? ` · variance ${diff > 0 ? "+" : ""}${diff}` : ""}`} />
    </Dialog>
  )
}
