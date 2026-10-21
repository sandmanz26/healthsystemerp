/**
 * Diagnoses (ICD-10) and procedures (ICD-9-CM). Exactly one primary diagnosis — claims and
 * national reporting depend on it, so the UI makes the primary one obvious.
 */
import { Button, Chip } from "@heroui/react"
import { Star, X } from "lucide-react"
import { Panel } from "@/components/ui/panel"
import { ICD10, ICD9CM } from "@/domain/catalog"
import type { Encounter } from "@/domain/types"
import { useActions } from "@/store"
import { CodeSearch } from "./code-search"

export function DiagnosisSection({ encounter, readOnly }: { encounter: Encounter; readOnly: boolean }) {
  const { setDiagnoses, setProcedures } = useActions()
  const dx = encounter.diagnoses
  const symptomOnly = dx.find((d) => d.primary)?.code.startsWith("R")

  return (
    <div className="space-y-4">
      <Panel title="Diagnosis (ICD-10)" description="Diagnosis pertama otomatis menjadi diagnosis utama; klik bintang untuk mengubah.">
        {!readOnly && (
          <div className="mb-3">
            <CodeSearch
              label="Cari diagnosis"
              codes={ICD10}
              exclude={dx.map((d) => d.code)}
              placeholder="Ketik kode atau nama, mis. I10 atau hipertensi"
              onPick={(c) => setDiagnoses(encounter.id, [...dx, { code: c.code, display: c.display, primary: dx.length === 0 }])}
            />
          </div>
        )}
        {dx.length === 0 ? (
          <p className="text-sm text-muted">Belum ada diagnosis. Diagnosis utama wajib sebelum kunjungan diselesaikan.</p>
        ) : (
          <ul className="space-y-2">
            {dx.map((d) => (
              <li key={d.code} className="flex items-center gap-3 rounded-xl bg-surface-secondary px-3 py-2">
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  aria-label={d.primary ? "Diagnosis utama" : "Jadikan diagnosis utama"}
                  isDisabled={readOnly}
                  onPress={() => setDiagnoses(encounter.id, dx.map((x) => ({ ...x, primary: x.code === d.code })))}
                >
                  <Star className={d.primary ? "size-4 fill-warning text-warning" : "size-4 text-muted"} />
                </Button>
                <span className="tabular w-14 font-semibold">{d.code}</span>
                <span className="flex-1 text-sm">{d.display}</span>
                {d.primary && (
                  <Chip size="sm" color="accent" variant="soft">
                    Utama
                  </Chip>
                )}
                {!readOnly && (
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    aria-label={`Hapus ${d.code}`}
                    onPress={() => {
                      const rest = dx.filter((x) => x.code !== d.code)
                      if (d.primary && rest.length) rest[0] = { ...rest[0], primary: true }
                      setDiagnoses(encounter.id, rest)
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {symptomOnly && <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-soft-foreground">Diagnosis utama berupa kode gejala (R). Klaim JKN sering dikembalikan — gunakan diagnosis yang lebih spesifik bila sudah ditegakkan.</p>}
      </Panel>

      <Panel title="Tindakan (ICD-9-CM)">
        {!readOnly && (
          <div className="mb-3">
            <CodeSearch label="Cari tindakan" codes={ICD9CM} exclude={encounter.procedures.map((p) => p.code)} placeholder="mis. 89.52 atau EKG" onPick={(c) => setProcedures(encounter.id, [...encounter.procedures, c])} />
          </div>
        )}
        {encounter.procedures.length === 0 ? (
          <p className="text-sm text-muted">Belum ada tindakan.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {encounter.procedures.map((p) => (
              <Chip key={p.code} variant="soft">
                <b className="tabular">{p.code}</b> {p.display}
                {!readOnly && (
                  <button type="button" aria-label={`Hapus ${p.code}`} className="ml-1" onClick={() => setProcedures(encounter.id, encounter.procedures.filter((x) => x.code !== p.code))}>
                    <X className="size-3" />
                  </button>
                )}
              </Chip>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
