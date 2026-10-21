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
import type { Patient, PayerType } from "@/domain/types"
import { formatDate } from "@/lib/format"
import { useStore } from "@/store"
import { matchPatient } from "@/domain/search"
import { PatientForm } from "./patient-form"

export default function PatientsPage() {
  const patients = useStore((s) => s.patients)
  const encounters = useStore((s) => s.encounters)
  const navigate = useNavigate()
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
      header: "Pasien",
      sortValue: (p) => p.name,
      cell: (p) => (
        <div>
          <div className="font-medium">{p.name}</div>
          <div className="tabular text-xs text-muted">RM {p.mrn}</div>
        </div>
      ),
    },
    { id: "nik", header: "NIK", cell: (p) => <span className="tabular text-sm">{p.nik}</span> },
    { id: "age", header: "Umur / JK", sortValue: (p) => p.birthDate, cell: (p) => `${ageLabel(p.birthDate)} · ${p.gender === "female" ? "P" : "L"}` },
    { id: "payer", header: "Penjamin", cell: (p) => <PayerChip payer={p.payer} /> },
    { id: "allergy", header: "Alergi", cell: (p) => (p.allergies.length ? <span className="text-sm font-medium text-danger">{p.allergies.map((a) => a.substance).join(", ")}</span> : <span className="text-muted">—</span>) },
    { id: "last", header: "Kunjungan terakhir", sortValue: (p) => lastVisit.get(p.id) ?? "", cell: (p) => (lastVisit.has(p.id) ? formatDate(lastVisit.get(p.id)!) : <span className="text-muted">—</span>) },
  ]

  return (
    <Page>
      <PageHeader
        title="Master Pasien"
        description="Satu rekam medis per pasien untuk semua layanan. Cari dengan No. RM, NIK, No. BPJS, atau nama."
        actions={
          <Button variant="primary" onPress={() => setCreating(true)}>
            <UserPlus className="size-4" aria-hidden />
            Pasien baru
          </Button>
        }
      />
      <Panel flush>
        <div className="flex flex-col gap-3 border-b border-separator p-4 md:flex-row md:items-center md:justify-between">
          <SearchField aria-label="Cari pasien" value={query} onChange={setQuery} className="w-full md:max-w-md">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="No. RM, NIK, No. BPJS, atau nama" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <Segmented
            label="Penjamin"
            value={payer}
            onChange={setPayer}
            options={[
              { value: "all", label: "Semua", count: patients.length },
              { value: "bpjs", label: "BPJS", count: patients.filter((p) => p.payer === "bpjs").length },
              { value: "umum", label: "Umum", count: patients.filter((p) => p.payer === "umum").length },
              { value: "asuransi", label: "Asuransi", count: patients.filter((p) => p.payer === "asuransi").length },
            ]}
          />
        </div>
        <DataTable
          label="Daftar pasien"
          rows={rows}
          columns={columns}
          rowKey={(p) => p.id}
          onRowAction={(p) => navigate(`/patients/${p.id}`)}
          defaultSort={{ column: "last", direction: "descending" }}
          empty={<Empty title="Pasien tidak ditemukan" description="Coba kata kunci lain atau daftarkan pasien baru." />}
        />
      </Panel>
      {creating && <PatientForm isOpen onOpenChange={setCreating} onSaved={(id) => navigate(`/patients/${id}`)} />}
    </Page>
  )
}
