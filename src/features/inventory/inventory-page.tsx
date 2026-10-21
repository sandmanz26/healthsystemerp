/**
 * Logistics: stock by batch, expiry (FEFO), minimum stock and purchase requests.
 * "Buat permintaan" pre-fills every item under minimum — the request people usually
 * assemble by hand from a spreadsheet.
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
import { formatDate, formatDateTime, formatRupiah } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useNow } from "@/lib/use-now"
import { useActions, useStore } from "@/store"
import { stockOf, useInventoryMap, useSession, useStaffMap } from "@/store/selectors"

const DAY = 86400000
type Category = InventoryItem["category"] | "all"
const CATEGORY_LABEL: Record<InventoryItem["category"], string> = { obat: "Obat", bmhp: "BMHP", reagen: "Reagen", umum: "Umum" }
const PR_STATUS: Record<PurchaseStatus, { label: string; color: "default" | "accent" | "success" | "danger" | "warning" }> = {
  draft: { label: "Draf", color: "default" },
  submitted: { label: "Menunggu persetujuan", color: "warning" },
  approved: { label: "Disetujui", color: "accent" },
  received: { label: "Diterima", color: "success" },
  rejected: { label: "Ditolak", color: "danger" },
}

export default function InventoryPage() {
  const inventory = useStore((s) => s.inventory)
  const purchases = useStore((s) => s.purchases)
  const movements = useStore((s) => s.movements)
  const items = useInventoryMap()
  const staff = useStaffMap()
  const { role } = useSession()
  const { setPurchaseStatus, adjustStock } = useActions()
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
            {i.highAlert && <Chip size="sm" color="danger" variant="soft">High alert</Chip>}
            {i.category === "obat" && !i.fornas && <Chip size="sm" variant="soft">Non-Fornas</Chip>}
          </div>
          <div className="text-xs text-muted">{CATEGORY_LABEL[i.category]}{i.form ? ` · ${i.form}` : ""}</div>
        </div>
      ),
    },
    {
      id: "stock",
      header: "Stok / minimum",
      sortValue: (i) => stockOf(i) / i.minStock,
      cell: (i) => {
        const s = stockOf(i)
        const ratio = Math.min(100, (s / (i.minStock * 2)) * 100)
        return (
          <div className="w-40">
            <div className={cn("tabular text-sm", s < i.minStock && "font-semibold text-danger")}>
              {s} / {i.minStock} {i.unit}
            </div>
            <ProgressBar value={ratio} aria-label={`Stok ${i.name}`} color={s < i.minStock ? "danger" : "success"} size="sm">
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
      header: "ED terdekat",
      sortValue: (i) => [...i.batches].sort((a, b) => a.expiry.localeCompare(b.expiry))[0]?.expiry ?? "9",
      cell: (i) => {
        const b = [...i.batches].sort((a, b) => a.expiry.localeCompare(b.expiry))[0]
        if (!b) return <span className="text-muted">—</span>
        const soon = new Date(b.expiry).getTime() < now + 90 * DAY
        return <span className={cn("tabular text-sm", soon && "font-semibold text-warning")}>{formatDate(b.expiry)}</span>
      },
    },
    { id: "price", header: "Harga", align: "end", cell: (i) => <span className="tabular text-sm">{formatRupiah(i.price)}</span> },
    {
      id: "actions",
      header: "",
      align: "end",
      cell: (i) => (
        <Button size="sm" variant="ghost" onPress={() => setAdjusting(i)}>
          Sesuaikan
        </Button>
      ),
    },
  ]

  const canApprove = role === "manager" || role === "admin"

  return (
    <Page>
      <PageHeader
        title="Logistik & Inventori"
        description="Stok per batch dengan prinsip FEFO (first expired, first out)."
        actions={
          <Button variant="primary" onPress={() => setRequesting(true)}>
            <PackagePlus className="size-4" aria-hidden /> Buat permintaan pembelian
          </Button>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Di bawah stok minimum" value={low.length} icon={AlertTriangle} tone={low.length ? "danger" : "success"} />
        <Stat label="Kedaluwarsa ≤ 3 bulan" value={expiring.length} icon={CalendarX} tone={expiring.length ? "warning" : "default"} hint={expired.length ? `${expired.length} batch sudah kedaluwarsa` : undefined} />
        <Stat label="Jumlah item" value={inventory.length} icon={Boxes} />
        <Stat label="Nilai persediaan" value={formatRupiah(value)} icon={Wallet} tone="accent" />
      </div>

      <Tabs>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Inventori">
            <Tabs.Tab className="whitespace-nowrap" id="stock">Stok<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab className="whitespace-nowrap" id="expiry">Kedaluwarsa ({expiring.length + expired.length})<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab className="whitespace-nowrap" id="purchase">Permintaan pembelian ({purchases.filter((p) => p.status === "submitted").length})<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab className="whitespace-nowrap" id="movement">Mutasi<Tabs.Indicator /></Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="stock" className="pt-4">
          <Panel flush>
            <div className="border-b border-separator p-4">
              <Segmented label="Kategori" value={category} onChange={setCategory} options={[{ value: "all", label: "Semua" }, ...(Object.keys(CATEGORY_LABEL) as InventoryItem["category"][]).map((c) => ({ value: c, label: CATEGORY_LABEL[c], count: inventory.filter((i) => i.category === c).length }))]} />
            </div>
            <DataTable label="Stok" rows={rows} columns={columns} rowKey={(i) => i.id} defaultSort={{ column: "stock", direction: "ascending" }} />
          </Panel>
        </Tabs.Panel>

        <Tabs.Panel id="expiry" className="pt-4">
          <Panel flush>
            {expired.length + expiring.length === 0 ? (
              <Empty title="Tidak ada batch mendekati kedaluwarsa" />
            ) : (
              <ul className="divide-y divide-separator">
                {[...expired, ...expiring].map((b) => {
                  const isExpired = new Date(b.expiry).getTime() < now
                  return (
                    <li key={`${b.item.id}-${b.batch}`} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{b.item.name}</div>
                        <div className="tabular text-xs text-muted">
                          Batch {b.batch} · {b.qty} {b.item.unit} · {formatRupiah(b.qty * b.item.price)}
                        </div>
                      </div>
                      <Chip size="sm" color={isExpired ? "danger" : "warning"} variant="soft">
                        {isExpired ? "Kedaluwarsa" : "ED"} {formatDate(b.expiry)}
                      </Chip>
                      {isExpired && (
                        <Button size="sm" variant="danger-soft" onPress={() => { adjustStock(b.item.id, -b.qty, "expire", b.batch); toast("Batch dimusnahkan & dicatat") }}>
                          Musnahkan
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
          {purchases.length === 0 && <Panel><Empty title="Belum ada permintaan pembelian" /></Panel>}
          {purchases.map((p) => (
            <PurchaseCard key={p.id} pr={p} canApprove={canApprove} onStatus={(s) => { setPurchaseStatus(p.id, s); toast.success(`Permintaan ${PR_STATUS[s].label.toLowerCase()}`, { description: s === "received" ? "Stok bertambah sebagai batch baru." : undefined }) }} items={items} staffName={(id) => staff.get(id)?.name ?? id} />
          ))}
        </Tabs.Panel>

        <Tabs.Panel id="movement" className="pt-4">
          <Panel flush>
            <ul className="divide-y divide-separator">
              {movements.slice(0, 60).map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <span className="tabular w-36 shrink-0 text-muted">{formatDateTime(m.at)}</span>
                  <span className="flex-1">{items.get(m.itemId)?.name}</span>
                  <span className="text-xs text-muted">{{ dispense: "Penyerahan", receive: "Penerimaan", adjust: "Penyesuaian", expire: "Pemusnahan" }[m.reason]}</span>
                  <span className={cn("tabular w-16 text-right font-semibold", m.qty < 0 ? "text-danger" : "text-success")}>
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
      title={`Permintaan ${formatDate(pr.createdAt)}`}
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
            <span className="tabular">
              {l.qty} {items.get(l.itemId)?.unit}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-separator pt-3">
        <span className="tabular text-sm">Estimasi {formatRupiah(total)}</span>
        <div className="flex gap-2">
          {pr.status === "submitted" && canApprove && (
            <>
              <Button size="sm" variant="ghost" onPress={() => onStatus("rejected")}>
                Tolak
              </Button>
              <Button size="sm" variant="primary" onPress={() => onStatus("approved")}>
                Setujui
              </Button>
            </>
          )}
          {pr.status === "submitted" && !canApprove && <span className="text-xs text-muted">Menunggu persetujuan manajemen</span>}
          {pr.status === "approved" && (
            <Button size="sm" variant="primary" onPress={() => onStatus("received")}>
              Barang diterima
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
      title="Permintaan pembelian"
      description="Item di bawah stok minimum sudah dimasukkan, dengan jumlah sampai 2× stok minimum."
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            isDisabled={!lines.some((l) => Number(l.qty) > 0)}
            onPress={() => {
              createPurchase(lines.filter((l) => Number(l.qty) > 0).map((l) => ({ itemId: l.itemId, qty: Number(l.qty) })), note || undefined)
              toast.success("Permintaan diajukan", { description: "Menunggu persetujuan manajemen." })
              onClose()
            }}
          >
            Ajukan
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
                stok {stockOf(map.get(l.itemId)!)} / min {map.get(l.itemId)?.minStock}
              </div>
            </div>
            <TextInput label="Jumlah" value={l.qty} onChange={(v) => setLines((ls) => ls.map((x, idx) => (idx === i ? { ...x, qty: v.replace(/\D/g, "") } : x)))} inputMode="numeric" />
            <Button variant="ghost" size="sm" onPress={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>
              Hapus
            </Button>
          </li>
        ))}
      </ul>
      <SelectInput
        label="Tambah item"
        value={adding}
        onChange={(v) => {
          setLines((ls) => (ls.some((l) => l.itemId === v) ? ls : [...ls, { itemId: v, qty: String(map.get(v)?.minStock ?? 1) }]))
          setAdding(null)
        }}
        options={inventory.filter((i) => !lines.some((l) => l.itemId === i.id)).map((i) => ({ value: i.id, label: i.name }))}
        placeholder="Pilih item…"
      />
      <TextInput label="Catatan" value={note} onChange={setNote} />
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
      title="Stok opname"
      description={item.name}
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            isDisabled={diff === 0 || counted === ""}
            onPress={() => {
              adjustStock(item.id, diff, "adjust")
              toast.success("Stok disesuaikan", { description: `${diff > 0 ? "+" : ""}${diff} ${item.unit}` })
              onClose()
            }}
          >
            Simpan
          </Button>
        </>
      }
    >
      <TextInput label="Jumlah fisik" value={counted} onChange={(v) => setCounted(v.replace(/\D/g, ""))} inputMode="numeric" suffix={item.unit} description={`Di sistem: ${stockOf(item)} ${item.unit}${diff ? ` · selisih ${diff > 0 ? "+" : ""}${diff}` : ""}`} />
    </Dialog>
  )
}
