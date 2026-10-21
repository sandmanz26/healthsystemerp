/**
 * Staff, licences (STR/SIP) and the duty roster. A clinician with an expired SIP must not
 * practise, so licence status is visible next to every name.
 */
import { Button, Chip, Tabs } from "@heroui/react"
import { BadgeAlert, CalendarDays, ChevronLeft, ChevronRight, UserCheck, Users } from "lucide-react"
import { useMemo, useState } from "react"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Page, PageHeader } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import { Stat } from "@/components/ui/stat"
import { ROLES } from "@/domain/roles"
import type { ShiftCode, Staff } from "@/domain/types"
import { cn } from "@/lib/cn"
import { dayKey, formatDate } from "@/lib/format"
import { useActions, useStore } from "@/store"
import { useUnitName } from "@/store/selectors"

const SHIFT: Record<ShiftCode, { label: string; hours: string; className: string }> = {
  P: { label: "Pagi", hours: "07–14", className: "bg-accent-soft text-accent-soft-foreground" },
  S: { label: "Sore", hours: "14–21", className: "bg-warning-soft text-warning-soft-foreground" },
  M: { label: "Malam", hours: "21–07", className: "bg-[oklch(0.35_0.06_270)] text-white" },
  L: { label: "Libur", hours: "", className: "bg-default text-muted" },
}
const CYCLE: ShiftCode[] = ["P", "S", "M", "L"]
const DAY = 86400000
const WEEKDAY = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]

function licenceState(iso?: string): { label: string; color: "success" | "warning" | "danger" | "default" } {
  if (!iso) return { label: "—", color: "default" }
  const days = Math.round((new Date(iso).getTime() - Date.now()) / DAY)
  if (days < 0) return { label: `Kedaluwarsa ${formatDate(iso)}`, color: "danger" }
  if (days <= 60) return { label: `${days} hari lagi`, color: "warning" }
  return { label: formatDate(iso), color: "success" }
}

/** Which shift covers the current hour. */
function currentShift(): ShiftCode {
  const h = new Date().getHours()
  return h >= 7 && h < 14 ? "P" : h >= 14 && h < 21 ? "S" : "M"
}

export default function HrPage() {
  const staff = useStore((s) => s.staff)
  const roster = useStore((s) => s.roster)
  const unitName = useUnitName()
  const { setShift } = useActions()
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return d
  })
  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY))
  const rosterMap = useMemo(() => new Map(roster.map((r) => [`${r.staffId}:${r.date}`, r.shift])), [roster])
  const rostered = staff.filter((s) => roster.some((r) => r.staffId === s.id))
  const clinical = staff.filter((s) => s.sipExpires)
  const expiring = clinical.filter((s) => ["warning", "danger"].includes(licenceState(s.sipExpires).color) || ["warning", "danger"].includes(licenceState(s.strExpires).color))
  const onDuty = rostered.filter((s) => rosterMap.get(`${s.id}:${dayKey()}`) === currentShift())

  const columns: Column<Staff>[] = [
    {
      id: "name",
      header: "Nama",
      isRowHeader: true,
      sortValue: (s) => s.name,
      cell: (s) => (
        <div>
          <div className="font-medium">{s.name}</div>
          <div className="text-xs text-muted">
            {s.title}
            {s.specialty && ` · ${s.specialty}`}
          </div>
        </div>
      ),
    },
    { id: "role", header: "Peran", sortValue: (s) => s.role, cell: (s) => <Chip size="sm" variant="soft">{ROLES[s.role].label}</Chip> },
    { id: "unit", header: "Unit", cell: (s) => <span className="text-sm">{unitName(s.unitId)}</span> },
    { id: "phone", header: "Telepon", cell: (s) => <span className="tabular text-sm">{s.phone}</span> },
    {
      id: "str",
      header: "STR",
      sortValue: (s) => s.strExpires ?? "9",
      cell: (s) => {
        const l = licenceState(s.strExpires)
        return l.color === "default" ? <span className="text-muted">—</span> : <Chip size="sm" variant="soft" color={l.color}>{l.label}</Chip>
      },
    },
    {
      id: "sip",
      header: "SIP",
      sortValue: (s) => s.sipExpires ?? "9",
      cell: (s) => {
        const l = licenceState(s.sipExpires)
        return l.color === "default" ? <span className="text-muted">—</span> : <Chip size="sm" variant="soft" color={l.color}>{l.label}</Chip>
      },
    },
  ]

  return (
    <Page>
      <PageHeader title="SDM & Jadwal Jaga" description="Direktori staf, masa berlaku STR/SIP, dan roster shift." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total staf" value={staff.length} icon={Users} />
        <Stat label={`Bertugas sekarang (shift ${SHIFT[currentShift()].label.toLowerCase()})`} value={onDuty.length} icon={UserCheck} tone="accent" />
        <Stat label="STR/SIP ≤ 60 hari / kedaluwarsa" value={expiring.length} icon={BadgeAlert} tone={expiring.length ? "danger" : "success"} />
        <Stat label="Tenaga klinis berlisensi" value={clinical.length} icon={CalendarDays} />
      </div>
      <Tabs>
        <Tabs.ListContainer>
          <Tabs.List aria-label="SDM">
            <Tabs.Tab id="roster">Jadwal jaga<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab id="directory">Direktori & lisensi<Tabs.Indicator /></Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="roster" className="pt-4">
          <Panel
            title={`Minggu ${formatDate(days[0].toISOString())} – ${formatDate(days[6].toISOString())}`}
            description="Klik sel untuk mengganti shift (P → S → M → L)."
            actions={
              <div className="flex gap-1">
                <Button isIconOnly size="sm" variant="tertiary" aria-label="Minggu sebelumnya" onPress={() => setWeekStart((d) => new Date(d.getTime() - 7 * DAY))}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button isIconOnly size="sm" variant="tertiary" aria-label="Minggu berikutnya" onPress={() => setWeekStart((d) => new Date(d.getTime() + 7 * DAY))}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            }
            flush
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-separator text-xs text-muted">
                    <th className="px-4 py-2 text-left font-medium">Staf</th>
                    {days.map((d) => (
                      <th key={d.toISOString()} className={cn("px-2 py-2 font-medium", dayKey(d) === dayKey() && "text-accent")}>
                        {WEEKDAY[d.getDay()]} {d.getDate()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-separator">
                  {rostered.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-2">
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-muted">{unitName(s.unitId)}</div>
                      </td>
                      {days.map((d) => {
                        const key = dayKey(d)
                        const code = rosterMap.get(`${s.id}:${key}`)
                        return (
                          <td key={key} className="px-1 py-1.5 text-center">
                            <button
                              type="button"
                              aria-label={`${s.name} ${key}: ${code ? SHIFT[code].label : "kosong"}`}
                              onClick={() => setShift(s.id, key, CYCLE[(CYCLE.indexOf(code ?? "L") + 1) % CYCLE.length])}
                              className={cn("w-full rounded-lg px-1 py-1.5 text-xs font-semibold transition hover:ring-2 hover:ring-accent/40", code ? SHIFT[code].className : "bg-surface-secondary text-muted")}
                            >
                              {code ?? "—"}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-3 border-t border-separator px-4 py-2 text-xs text-muted">
              {CYCLE.map((c) => (
                <span key={c} className="flex items-center gap-1.5">
                  <span className={cn("rounded px-1.5 font-semibold", SHIFT[c].className)}>{c}</span>
                  {SHIFT[c].label} {SHIFT[c].hours}
                </span>
              ))}
            </div>
          </Panel>
        </Tabs.Panel>
        <Tabs.Panel id="directory" className="pt-4">
          <Panel flush>
            <DataTable label="Direktori staf" rows={staff} columns={columns} rowKey={(s) => s.id} defaultSort={{ column: "sip", direction: "ascending" }} />
          </Panel>
        </Tabs.Panel>
      </Tabs>
    </Page>
  )
}
