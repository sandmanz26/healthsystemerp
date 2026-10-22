import { Button, SearchField } from "@heroui/react"
import { UserPlus } from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { PayerChip } from "@/components/status"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Empty } from "@/components/ui/empty"
import { Page, PageHeader } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import { Segmented } from "@/components/ui/segmented"
import { ageLabel } from "@/domain/clinical"
import { PAYER_LABEL, PAYERS_BY_REGION } from "@/domain/finance"
import { formatNhsNumber } from "@/domain/interop"
import type { Patient, PayerType } from "@/domain/types"
import { formatDate } from "@/lib/format"
import { useStore } from "@/store"
import { useRegion } from "@/store/selectors"
import { codeStatusLabel } from "@/components/clinical/labels"
import { matchPatient } from "@/domain/search"
import { PatientForm } from "./patient-form"

export default function PatientsPage() {
  const patients = useStore((s) => s.patients)
  const encounters = useStore((s) => s.encounters)
  const navigate = useNavigate()
  const region = useRegion()
  const [query, setQuery] = useState("")
  const [payer, setPayer] = useState<PayerType | "all">("all")
  const [creating, setCreating] = useState(false)

  const lastVisit = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of encounters) if (!m.has(e.patientId) || m.get(e.patientId)! < e.createdAt) m.set(e.patientId, e.createdAt)
    return m
  }, [encounters])

  const rows = useMemo(() => patients.filter((p) => (payer === "all" || p.payer === payer) && matchPatient(p, query)), [patients, payer, query])

  const columns: Column<Patient>[] = [
    {
      id: "name",
      header: "Patient",
      sortValue: (p) => p.name,
      cell: (p) => (
        <div>
          <div className="font-medium">{p.name}</div>
          <div className="num text-xs text-muted">MRN {p.mrn}</div>
        </div>
      ),
    },
    region === "uk"
      ? { id: "nhs", header: "NHS number", cell: (p) => <span className="num text-sm">{p.nhsNumber ? formatNhsNumber(p.nhsNumber) : <span className="text-muted">Not traced</span>}</span> }
      : { id: "dob", header: "DOB", sortValue: (p) => p.birthDate, cell: (p) => <span className="num text-sm">{formatDate(p.birthDate)}</span> },
    { id: "age", header: "Age / sex", sortValue: (p) => p.birthDate, cell: (p) => <span className="num">{`${ageLabel(p.birthDate)} · ${p.gender === "female" ? "F" : "M"}`}</span> },
    {
      id: "payer",
      header: region === "us" ? "Coverage" : "Funding",
      cell: (p) => (
        <div className="flex flex-col items-start gap-0.5">
          <PayerChip payer={p.payer} />
          {p.coverage && p.payer !== "overseas" && <span className="text-xs text-muted">{p.coverage.payerName}</span>}
        </div>
      ),
    },
    {
      id: "code",
      header: "Code status",
      sortValue: (p) => p.codeStatus,
      cell: (p) => <span className={p.codeStatus === "full" ? "text-sm text-muted" : "text-sm font-semibold text-band-dnr"}>{codeStatusLabel(p.codeStatus, region)}</span>,
    },
    { id: "allergy", header: "Allergies", cell: (p) => (p.allergies.length ? <span className="text-sm font-medium text-danger">{p.allergies.map((a) => a.substance).join(", ")}</span> : <span className="text-muted">—</span>) },
    { id: "last", header: "Last visit", sortValue: (p) => lastVisit.get(p.id) ?? "", cell: (p) => (lastVisit.has(p.id) ? formatDate(lastVisit.get(p.id)!) : <span className="text-muted">—</span>) },
  ]

  return (
    <Page>
      <PageHeader
        title="Patients"
        actions={
          <Button variant="primary" onPress={() => setCreating(true)}>
            <UserPlus className="size-4" aria-hidden />
            New patient
          </Button>
        }
      />
      <Panel flush>
        <div className="flex flex-col gap-3 border-b border-separator p-4 md:flex-row md:items-center md:justify-between">
          <SearchField aria-label="Search patients" value={query} onChange={setQuery} className="w-full md:max-w-md">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder={region === "us" ? "Name, MRN, member ID or DOB" : "Name, hospital number, NHS number or DOB"} />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <Segmented
            label={region === "us" ? "Payer class" : "Funding"}
            value={payer}
            onChange={setPayer}
            options={[
              { value: "all" as const, label: "All", count: patients.length },
              ...PAYERS_BY_REGION[region].map((v) => ({ value: v, label: PAYER_LABEL[v], count: patients.filter((p) => p.payer === v).length })),
            ]}
          />
        </div>
        <DataTable
          label="Patient list"
          rows={rows}
          columns={columns}
          rowKey={(p) => p.id}
          onRowAction={(p) => navigate(`/patients/${p.id}`)}
          defaultSort={{ column: "last", direction: "descending" }}
          empty={<Empty title="No matching patients" description="Try another identifier, or register a new patient." />}
        />
      </Panel>
      {creating && <PatientForm isOpen onOpenChange={setCreating} onSaved={(id) => navigate(`/patients/${id}`)} />}
    </Page>
  )
}
