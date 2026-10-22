/**
 * Facility settings: profile and market pack, units, the role × module access matrix, the
 * access audit trail required by HIPAA (US) / UK GDPR and the DSP Toolkit (UK), and
 * demo-data controls.
 */
import { Button, Chip, Tabs } from "@heroui/react"
import { Check, Globe2, RefreshCw, RotateCcw, ShieldAlert } from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Dialog } from "@/components/ui/dialog"
import { TextInput } from "@/components/ui/fields"
import { Page, PageHeader } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import { Segmented } from "@/components/ui/segmented"
import { isValidNpi } from "@/domain/interop"
import { FACILITY_PRESETS, MODULES, moduleText } from "@/domain/modules"
import { REGIONS, type Region } from "@/domain/region"
import { ROLES, ROLE_ORDER } from "@/domain/roles"
import type { AuditEntry, UnitKind } from "@/domain/types"
import { cn } from "@/lib/cn"
import { formatDateTime } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useActions, useStore } from "@/store"
import { useEnabledModules, useRegion, useStaffMap } from "@/store/selectors"

const UNIT_KIND: Record<Region, Record<UnitKind, string>> = {
  us: { clinic: "Ambulatory clinic", ed: "Emergency department", ward: "Inpatient unit", icu: "Intensive care", or: "Operating rooms", lab: "Laboratory", rad: "Imaging", pharmacy: "Pharmacy", admin: "Administration" },
  uk: { clinic: "Outpatient clinic", ed: "Emergency department (A&E)", ward: "Ward", icu: "Critical care", or: "Theatres", lab: "Pathology", rad: "Radiology", pharmacy: "Pharmacy", admin: "Administration" },
}

/** Region-specific identifiers on the facility profile. */
const ID_FIELDS: Record<Region, { code: string; codeHint: string; orgId: string; orgHint: string }> = {
  us: {
    code: "CMS Certification Number (CCN)",
    codeHint: "6 characters, e.g. 360001 — state code + facility type range.",
    orgId: "Organization NPI (Type 2)",
    orgHint: "10 digits with a Luhn check digit (NPPES).",
  },
  uk: {
    code: "ODS code (site)",
    codeHint: "Organisation Data Service code, e.g. RR813.",
    orgId: "NHS trust",
    orgHint: "Parent NHS trust or foundation trust that runs this site.",
  },
}

const AUDIT_BASIS: Record<Region, string> = {
  us: "HIPAA Security Rule 45 CFR §164.312(b) — audit controls · §164.308(a)(1)(ii)(D) information system activity review",
  uk: "UK GDPR Art. 5(1)(f) integrity & confidentiality · NHS Data Security and Protection Toolkit (access monitoring)",
}

type AuditFilter = "all" | "break-glass"

export default function SettingsPage() {
  const facility = useStore((s) => s.facility)
  const units = useStore((s) => s.units)
  const audit = useStore((s) => s.audit)
  const region = useRegion()
  const staff = useStaffMap()
  const enabled = useEnabledModules()
  const { updateFacility, resetDemo, restartOnboarding } = useActions()
  const navigate = useNavigate()
  const [form, setForm] = useState(facility)
  const [confirm, setConfirm] = useState<"reset" | "restart" | "market" | null>(null)
  const [auditFilter, setAuditFilter] = useState<AuditFilter>("all")
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }))
  const modules = MODULES.filter((m) => enabled.has(m.id))
  const ids = ID_FIELDS[region]
  const pack = REGIONS[region]
  const preset = FACILITY_PRESETS.find((p) => p.id === facility.type)

  const npiError = region === "us" && form.orgId.trim() && !isValidNpi(form.orgId.trim()) ? "Not a valid NPI — must be 10 digits with a valid Luhn check digit." : undefined

  const breakGlassCount = useMemo(() => audit.filter((a) => a.breakGlass).length, [audit])
  const auditRows = useMemo(() => (auditFilter === "break-glass" ? audit.filter((a) => a.breakGlass) : audit).slice(0, 300), [audit, auditFilter])

  const auditColumns: Column<AuditEntry>[] = [
    { id: "at", header: "Time", sortValue: (a) => a.at, cell: (a) => <span className="tabular whitespace-nowrap text-sm">{formatDateTime(a.at)}</span> },
    {
      id: "user",
      header: "User",
      sortValue: (a) => staff.get(a.userId)?.name ?? a.userId,
      cell: (a) => {
        const s = staff.get(a.userId)
        return (
          <span className="text-sm">
            {s?.name ?? a.userId}
            {s && <span className="block text-[11px] text-muted">{ROLES[s.role].label}</span>}
          </span>
        )
      },
    },
    {
      id: "action",
      header: "Action",
      isRowHeader: true,
      cell: (a) => (
        <span className={cn("block text-sm", a.breakGlass && "-my-1 rounded-md border-l-4 border-danger bg-danger-soft/60 py-1 pl-2 pr-1")}>
          <span className="flex flex-wrap items-center gap-1.5">
            {a.breakGlass && (
              <Chip size="sm" color="danger" variant="soft">
                <ShieldAlert className="size-3" aria-hidden /> Break the glass
              </Chip>
            )}
            {a.action}
          </span>
          {a.breakGlass && <span className="mt-0.5 block text-xs text-danger-soft-foreground">Reason: “{a.breakGlass.reason}”</span>}
        </span>
      ),
    },
    { id: "target", header: "Record / object", cell: (a) => <span className="text-sm text-muted">{a.target}</span> },
  ]

  const save = () => {
    if (npiError) return
    updateFacility(form)
    toast.success("Facility profile saved")
  }

  return (
    <Page>
      <PageHeader title="Settings" />
      <Tabs>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Settings">
            <Tabs.Tab id="profile">Facility<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab id="units">{region === "uk" ? "Wards & clinics" : "Units & clinics"}<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab id="access">Access control<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab id="audit">Access audit<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab id="demo">Demo data<Tabs.Indicator /></Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="profile" className="pt-4">
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
            <Panel title="Facility profile" description={preset ? `${preset.name[region]} · ${pack.name}` : pack.name}>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput label={region === "uk" ? "Hospital / site name" : "Facility name"} value={form.name} onChange={set("name")} className="sm:col-span-2" />
                <TextInput label="Street address" value={form.address} onChange={set("address")} className="sm:col-span-2" />
                <TextInput label={region === "uk" ? "Town / city" : "City, state"} value={form.city} onChange={set("city")} />
                <TextInput label={ids.code} value={form.code} onChange={set("code")} description={ids.codeHint} />
                <TextInput label={ids.orgId} value={form.orgId} onChange={set("orgId")} description={ids.orgHint} error={npiError} inputMode={region === "us" ? "numeric" : "text"} className="sm:col-span-2" />
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="primary" onPress={save} isDisabled={!!npiError}>
                  Save
                </Button>
              </div>
            </Panel>

            <Panel
              title={
                <span className="flex items-center gap-2">
                  <Globe2 className="size-4 text-muted" aria-hidden /> Market pack
                </span>
              }
              description="Read-only. Set at onboarding; drives code systems, units and rules on every screen."
              actions={
                <Button size="sm" variant="danger-soft" onPress={() => setConfirm("market")}>
                  Switch market
                </Button>
              }
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="num rounded-md bg-foreground px-2 py-0.5 text-xs font-bold text-background">{pack.short}</span>
                <span className="font-semibold">{pack.name}</span>
              </div>
              <dl className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-3 gap-y-2 text-sm">
                {[
                  ["Diagnoses", pack.dxSystem],
                  ["Procedures", pack.pxSystem],
                  ["Case-mix grouper", pack.grouper],
                  ["ED triage", pack.triage === "ESI" ? "ESI v5 (Emergency Severity Index)" : "MTS (Manchester Triage System)"],
                  ["FHIR profile", `FHIR R4 · ${pack.fhirProfile}`],
                  ["National ID", pack.nationalId ?? "None (MRN + payer member ID)"],
                  ["Privacy law", pack.privacyLaw],
                  ["Lab units", pack.labUnits === "si" ? "SI (mmol/L, µmol/L)" : "Conventional (mg/dL)"],
                  ["Temperature · weight", `°${pack.temperature} · ${pack.weight}`],
                  ["Currency · locale", `${pack.currency} · ${pack.locale}`],
                ].map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="label-caps pt-0.5 text-muted">{k}</dt>
                    <dd className="num text-[13px]">{v}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="units" className="pt-4">
          <Panel flush>
            <ul className="divide-y divide-separator">
              {units.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted">{UNIT_KIND[region][u.kind]}</div>
                  </div>
                  {u.code && (
                    <Chip size="sm" variant="soft">
                      <span className="num">{region === "us" ? "HL7 PV1-3" : "PV1-3 / ward code"} {u.code}</span>
                    </Chip>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        </Tabs.Panel>

        <Tabs.Panel id="access" className="pt-4">
          <Panel
            title="Role × module matrix"
            description={`Menu visibility per role (role-based access control${region === "uk" ? ", aligned to NHS RBAC" : ", HIPAA minimum necessary"}). Only enabled modules are listed; administrators see every enabled module.`}
            flush
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-separator text-xs text-muted">
                    <th className="sticky left-0 bg-surface px-4 py-2 text-left font-medium">Module</th>
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
                      <td className="sticky left-0 bg-surface px-4 py-2 font-medium">{moduleText(m.id, region).name}</td>
                      {ROLE_ORDER.map((r) => {
                        const on = r === "admin" || m.roles.includes(r)
                        return (
                          <td key={r} className="px-2 py-2 text-center">
                            <span className={cn("inline-grid size-6 place-items-center rounded-md", on ? "bg-accent-soft text-accent-soft-foreground" : "text-muted")} aria-label={on ? "Access" : "No access"}>
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
          <Panel
            title="Access audit"
            description="Every view and change to a patient record is logged with user, time and object. Break-the-glass access (outside a care relationship) requires a reason and is reviewed by the privacy officer."
            actions={
              <Segmented
                label="Filter audit entries"
                value={auditFilter}
                onChange={setAuditFilter}
                options={[
                  { value: "all", label: "All", count: audit.length },
                  { value: "break-glass", label: "Break-the-glass only", count: breakGlassCount },
                ]}
              />
            }
            flush
          >
            <DataTable
              label="Access audit log"
              rows={auditRows}
              columns={auditColumns}
              rowKey={(a) => a.id}
              defaultSort={{ column: "at", direction: "descending" }}
              empty={<p className="px-5 py-8 text-center text-sm text-muted">{auditFilter === "break-glass" ? "No break-the-glass access recorded." : "No audit entries yet."}</p>}
            />
            <p className="label-caps border-t border-separator px-5 py-2.5 text-muted">Basis: {AUDIT_BASIS[region]}</p>
          </Panel>
        </Tabs.Panel>

        <Tabs.Panel id="demo" className="pt-4">
          <Panel title="Demo data" description="All data is stored in this browser (IndexedDB). There is no server; no real patient data is used." className="max-w-2xl">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onPress={() => setConfirm("reset")}>
                <RefreshCw className="size-4" aria-hidden /> Regenerate today's data
              </Button>
              <Button variant="danger-soft" onPress={() => setConfirm("restart")}>
                <RotateCcw className="size-4" aria-hidden /> Restart onboarding
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
          title={confirm === "reset" ? "Regenerate demo data?" : confirm === "market" ? "Switch market pack?" : "Restart onboarding?"}
          description={
            confirm === "reset"
              ? "Every change you made will be lost. Your module choices are kept."
              : confirm === "market"
                ? `You will go back to onboarding to choose between the US and UK/Europe packs. Demo data is rebuilt for the market you pick — code systems, payers, triage scale and units all change. Current market: ${pack.name}.`
                : "All data and module choices are cleared."
          }
          footer={
            <>
              <Button variant="tertiary" onPress={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onPress={() => {
                  if (confirm === "reset") {
                    resetDemo()
                    toast.success("Demo data regenerated")
                  } else {
                    restartOnboarding()
                    navigate("/onboarding")
                  }
                  setConfirm(null)
                }}
              >
                {confirm === "market" ? "Choose market" : "Continue"}
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
