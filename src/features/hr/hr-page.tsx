/**
 * Medical staff & workforce: licence / registration status (state board or GMC/NMC/GPhC/HCPC),
 * NPI and DEA registration (US), resuscitation certification (BLS/ACLS in the US, Resuscitation
 * Council UK ILS/ALS) and the 12-hour duty roster. A clinician with a lapsed licence must not
 * practise, so its status sits next to every name.
 */
import { Button, Chip, Tabs } from "@heroui/react"
import { BadgeAlert, CalendarDays, ChevronLeft, ChevronRight, UserCheck, Users } from "lucide-react"
import { useMemo, useState } from "react"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Page, PageHeader } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import { Stat } from "@/components/ui/stat"
import { isValidNpi } from "@/domain/interop"
import { ROLES } from "@/domain/roles"
import type { ShiftCode, Staff } from "@/domain/types"
import { cn } from "@/lib/cn"
import { dayKey, formatDate } from "@/lib/format"
import { shiftAt } from "@/lib/shift"
import { useNow } from "@/lib/use-now"
import { useActions, useStore } from "@/store"
import { useRegion, useUnitName } from "@/store/selectors"

const SHIFT: Record<ShiftCode, { label: string; hours: string; className: string }> = {
  D: { label: "Day", hours: "07:00–19:00", className: "bg-accent-soft text-accent-soft-foreground" },
  N: { label: "Night", hours: "19:00–07:00", className: "bg-[oklch(0.35_0.06_270)] text-white" },
  OFF: { label: "Off", hours: "", className: "bg-default text-muted" },
}
const CYCLE: ShiftCode[] = ["D", "N", "OFF"]
const DAY = 86400000
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

type Tone = "success" | "warning" | "danger" | "default"

function expiryState(iso: string | undefined, now: number): { label: string; color: Tone; days: number } {
  if (!iso) return { label: "—", color: "default", days: Infinity }
  const days = Math.round((new Date(iso).getTime() - now) / DAY)
  if (days < 0) return { label: `Expired ${formatDate(iso)}`, color: "danger", days }
  if (days <= 60) return { label: `${days} days left`, color: "warning", days }
  return { label: formatDate(iso), color: "success", days }
}

function ExpiryChip({ iso, now }: { iso?: string; now: number }) {
  const s = expiryState(iso, now)
  if (s.color === "default") return <span className="text-muted">—</span>
  return (
    <Chip size="sm" variant="soft" color={s.color} className="num whitespace-nowrap">
      {s.label}
    </Chip>
  )
}

export default function HrPage() {
  const staff = useStore((s) => s.staff)
  const roster = useStore((s) => s.roster)
  const unitName = useUnitName()
  const region = useRegion()
  const now = useNow(60_000)
  const { setShift } = useActions()
  const us = region === "us"
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    // US rosters run Sunday–Saturday; UK rotas Monday–Sunday.
    d.setDate(d.getDate() - (region === "us" ? d.getDay() : (d.getDay() + 6) % 7))
    return d
  })
  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY))
  const rosterMap = useMemo(() => new Map(roster.map((r) => [`${r.staffId}:${r.date}`, r.shift])), [roster])
  const rostered = useMemo(() => staff.filter((s) => roster.some((r) => r.staffId === s.id)), [staff, roster])
  const licensed = staff.filter((s) => s.license)
  const flagged = staff.filter((s) => [s.license?.expires, s.deaExpires, s.resusCertExpires].some((d) => ["warning", "danger"].includes(expiryState(d, now).color)))
  // A night shift that started yesterday evening is still on duty before 07:00.
  const current = shiftAt(now)
  const shiftDay = current.code === "N" && new Date(now).getHours() < 7 ? dayKey(now - DAY) : dayKey(now)
  const onDuty = rostered.filter((s) => rosterMap.get(`${s.id}:${shiftDay}`) === current.code)

  const columns: Column<Staff>[] = [
    {
      id: "name",
      header: "Name",
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
    {
      id: "role",
      header: "Role · unit",
      sortValue: (s) => s.role,
      cell: (s) => (
        <div className="space-y-0.5">
          <Chip size="sm" variant="soft">
            {ROLES[s.role].label}
          </Chip>
          <div className="text-xs text-muted">{unitName(s.unitId)}</div>
        </div>
      ),
    },
    {
      id: "license",
      header: us ? "License" : "Registration",
      sortValue: (s) => s.license?.expires ?? "9",
      cell: (s) =>
        s.license ? (
          <div className="space-y-0.5">
            <div className="num text-[11px] text-muted">
              {s.license.body} {s.license.number}
            </div>
            <ExpiryChip iso={s.license.expires} now={now} />
          </div>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    ...(us
      ? [
          {
            id: "npi",
            header: "NPI",
            cell: (s: Staff) =>
              s.npi ? (
                <div className="flex items-center gap-1.5">
                  <span className="num text-sm">{s.npi}</span>
                  {isValidNpi(s.npi) ? (
                    <Chip size="sm" variant="soft" color="success" title="Luhn check digit (prefix 80840) valid">
                      Valid
                    </Chip>
                  ) : (
                    <Chip size="sm" variant="soft" color="danger">
                      Invalid
                    </Chip>
                  )}
                </div>
              ) : (
                <span className="text-muted">—</span>
              ),
          },
          { id: "dea", header: "DEA registration", sortValue: (s: Staff) => s.deaExpires ?? "9", cell: (s: Staff) => <ExpiryChip iso={s.deaExpires} now={now} /> },
        ]
      : []),
    { id: "resus", header: us ? "BLS / ACLS" : "ILS / ALS", sortValue: (s) => s.resusCertExpires ?? "9", cell: (s) => <ExpiryChip iso={s.resusCertExpires} now={now} /> },
    { id: "phone", header: "Phone", cell: (s) => <span className="num text-sm">{s.phone}</span> },
  ]

  return (
    <Page>
      <PageHeader
        title={us ? "Medical Staff & Workforce" : "Workforce & Rota"}
        description={
          us
            ? "State license · NPI · DEA · BLS/ACLS"
            : "GMC · NMC · GPhC · HCPC · Resus Council ILS/ALS"
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total staff" value={staff.length} icon={Users} />
        <Stat label={`On duty now (${SHIFT[current.code].label.toLowerCase()} shift)`} value={onDuty.length} icon={UserCheck} tone="accent" />
        <Stat label="Credentials ≤ 60 days / lapsed" value={flagged.length} icon={BadgeAlert} tone={flagged.length ? "danger" : "success"} hint={us ? "License, DEA or BLS/ACLS" : "Registration or ILS/ALS"} />
        <Stat label={us ? "Licensed clinicians" : "Registered professionals"} value={licensed.length} icon={CalendarDays} />
      </div>
      <Tabs>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Workforce">
            <Tabs.Tab id="roster">
              {us ? "Schedule" : "Rota"}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="directory">
              {us ? "Directory & credentials" : "Directory & registration"}
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="roster" className="pt-4">
          <Panel
            title={`Week of ${formatDate(days[0].toISOString())} – ${formatDate(days[6].toISOString())}`}
            description="Select a cell to change the shift (D → N → OFF)."
            actions={
              <div className="flex gap-1">
                <Button isIconOnly size="sm" variant="tertiary" aria-label="Previous week" onPress={() => setWeekStart((d) => new Date(d.getTime() - 7 * DAY))}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button isIconOnly size="sm" variant="tertiary" aria-label="Next week" onPress={() => setWeekStart((d) => new Date(d.getTime() + 7 * DAY))}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            }
            flush
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="label-caps border-b border-separator text-muted">
                    <th className="px-4 py-2 text-left font-semibold">Staff</th>
                    {days.map((d) => (
                      <th key={d.toISOString()} className={cn("px-2 py-2 font-semibold", dayKey(d) === dayKey(now) && "text-accent")}>
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
                              aria-label={`${s.name} ${key}: ${code ? SHIFT[code].label : "unassigned"}`}
                              onClick={() => setShift(s.id, key, CYCLE[(CYCLE.indexOf(code ?? "OFF") + 1) % CYCLE.length])}
                              className={cn("num w-full rounded-lg px-1 py-1.5 text-xs font-semibold transition hover:ring-2 hover:ring-accent/40", code ? SHIFT[code].className : "bg-surface-secondary text-muted")}
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
                  <span className={cn("num rounded px-1.5 font-semibold", SHIFT[c].className)}>{c}</span>
                  {SHIFT[c].label} {SHIFT[c].hours}
                </span>
              ))}
            </div>
          </Panel>
        </Tabs.Panel>
        <Tabs.Panel id="directory" className="pt-4">
          <Panel flush>
            <DataTable label="Staff directory" rows={staff} columns={columns} rowKey={(s) => s.id} minWidth={us ? 1120 : 900} defaultSort={{ column: "license", direction: "ascending" }} />
          </Panel>
        </Tabs.Panel>
      </Tabs>
    </Page>
  )
}
