/**
 * Facility settings, units, the role × module access matrix, the audit trail required for
 * electronic medical records, and demo-data controls.
 */
import { Button, Chip, Tabs } from "@heroui/react"
import { Check, RefreshCw, RotateCcw } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Dialog } from "@/components/ui/dialog"
import { TextInput } from "@/components/ui/fields"
import { Page, PageHeader } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import { MODULES } from "@/domain/modules"
import { ROLES, ROLE_ORDER } from "@/domain/roles"
import type { AuditEntry, UnitKind } from "@/domain/types"
import { cn } from "@/lib/cn"
import { formatDateTime } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useActions, useStore } from "@/store"
import { useEnabledModules, useStaffMap } from "@/store/selectors"

const UNIT_KIND: Record<UnitKind, string> = { poli: "Poliklinik", er: "Gawat darurat", ward: "Ruang rawat", icu: "Intensif", or: "Kamar operasi", lab: "Laboratorium", rad: "Radiologi", pharmacy: "Farmasi", admin: "Administrasi" }

export default function SettingsPage() {
  const facility = useStore((s) => s.facility)
  const units = useStore((s) => s.units)
  const audit = useStore((s) => s.audit)
  const staff = useStaffMap()
  const enabled = useEnabledModules()
  const { updateFacility, resetDemo, restartOnboarding } = useActions()
  const navigate = useNavigate()
  const [form, setForm] = useState(facility)
  const [confirm, setConfirm] = useState<"reset" | "restart" | null>(null)
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }))
  const modules = MODULES.filter((m) => enabled.has(m.id))

  const auditColumns: Column<AuditEntry>[] = [
    { id: "at", header: "Waktu", sortValue: (a) => a.at, cell: (a) => <span className="tabular text-sm">{formatDateTime(a.at)}</span> },
    { id: "user", header: "Pengguna", cell: (a) => <span className="text-sm">{staff.get(a.userId)?.name ?? a.userId}</span> },
    { id: "action", header: "Aksi", isRowHeader: true, cell: (a) => <span className="text-sm">{a.action}</span> },
    { id: "target", header: "Objek", cell: (a) => <span className="text-sm text-muted">{a.target}</span> },
  ]

  return (
    <Page>
      <PageHeader title="Pengaturan" description="Profil faskes, unit layanan, hak akses, dan jejak audit." />
      <Tabs>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Pengaturan">
            <Tabs.Tab id="profile">Profil faskes<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab id="units">Unit layanan<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab id="access">Hak akses<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab id="audit">Audit log<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab id="demo">Data demo<Tabs.Indicator /></Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="profile" className="pt-4">
          <Panel title="Profil faskes" className="max-w-2xl">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Nama faskes" value={form.name} onChange={set("name")} className="sm:col-span-2" />
              <TextInput label="Kota" value={form.city} onChange={set("city")} />
              <TextInput label="Kode faskes (Kemenkes/BPJS)" value={form.code} onChange={set("code")} />
              <TextInput label="SATUSEHAT Organization ID" value={form.orgId} onChange={set("orgId")} />
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="primary" onPress={() => { updateFacility(form); toast.success("Profil disimpan") }}>
                Simpan
              </Button>
            </div>
          </Panel>
        </Tabs.Panel>

        <Tabs.Panel id="units" className="pt-4">
          <Panel flush>
            <ul className="divide-y divide-separator">
              {units.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted">{UNIT_KIND[u.kind]}</div>
                  </div>
                  {u.bpjsCode && <Chip size="sm" variant="soft">Kode poli BPJS {u.bpjsCode}</Chip>}
                </li>
              ))}
            </ul>
          </Panel>
        </Tabs.Panel>

        <Tabs.Panel id="access" className="pt-4">
          <Panel title="Matriks peran × modul" description="Menu yang terlihat per peran. Hanya modul aktif yang ditampilkan. Admin melihat semua modul aktif." flush>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-separator text-xs text-muted">
                    <th className="sticky left-0 bg-surface px-4 py-2 text-left font-medium">Modul</th>
                    {ROLE_ORDER.map((r) => (
                      <th key={r} className="px-2 py-2 font-medium">
                        {ROLES[r].label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-separator">
                  {modules.map((m) => (
                    <tr key={m.id}>
                      <td className="sticky left-0 bg-surface px-4 py-2 font-medium">{m.name}</td>
                      {ROLE_ORDER.map((r) => {
                        const on = r === "admin" || m.roles.includes(r)
                        return (
                          <td key={r} className="px-2 py-2 text-center">
                            <span className={cn("inline-grid size-6 place-items-center rounded-md", on ? "bg-accent-soft text-accent-soft-foreground" : "text-muted")} aria-label={on ? "Akses" : "Tidak ada akses"}>
                              {on ? <Check className="size-3.5" /> : "–"}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </Tabs.Panel>

        <Tabs.Panel id="audit" className="pt-4">
          <Panel title="Jejak audit" description="Setiap akses dan perubahan rekam medis dicatat (Permenkes 24/2022)." flush>
            <DataTable label="Audit log" rows={audit.slice(0, 200)} columns={auditColumns} rowKey={(a) => a.id} defaultSort={{ column: "at", direction: "descending" }} />
          </Panel>
        </Tabs.Panel>

        <Tabs.Panel id="demo" className="pt-4">
          <Panel title="Data demo" description="Semua data tersimpan di browser ini (IndexedDB). Tidak ada server." className="max-w-2xl">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onPress={() => setConfirm("reset")}>
                <RefreshCw className="size-4" aria-hidden /> Buat ulang data hari ini
              </Button>
              <Button variant="danger-soft" onPress={() => setConfirm("restart")}>
                <RotateCcw className="size-4" aria-hidden /> Mulai dari onboarding
              </Button>
            </div>
          </Panel>
        </Tabs.Panel>
      </Tabs>

      {confirm && (
        <Dialog
          isOpen
          onOpenChange={(o) => !o && setConfirm(null)}
          size="sm"
          title={confirm === "reset" ? "Buat ulang data demo?" : "Mulai ulang dari onboarding?"}
          description={confirm === "reset" ? "Semua perubahan yang Anda buat akan hilang. Pilihan modul tetap." : "Semua data dan pilihan modul dihapus."}
          footer={
            <>
              <Button variant="tertiary" onPress={() => setConfirm(null)}>
                Batal
              </Button>
              <Button
                variant="danger"
                onPress={() => {
                  if (confirm === "reset") {
                    resetDemo()
                    toast.success("Data demo dibuat ulang")
                  } else {
                    restartOnboarding()
                    navigate("/onboarding")
                  }
                  setConfirm(null)
                }}
              >
                Lanjutkan
              </Button>
            </>
          }
        >
          <span />
        </Dialog>
      )}
    </Page>
  )
}
