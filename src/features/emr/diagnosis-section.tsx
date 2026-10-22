/**
 * Diagnoses (ICD-10-CM in the US, WHO ICD-10 in the UK/EU, with SNOMED CT) and procedures
 * (CPT / OPCS-4). Exactly one principal diagnosis — claims, DRG/HRG grouping and national
 * reporting depend on it, so the UI makes it obvious. US inpatient diagnoses carry the
 * present-on-admission (POA) indicator required on UB-04 claims.
 */
import { Button, Chip } from "@heroui/react"
import { Star, X } from "lucide-react"
import { useMemo } from "react"
import { SelectInput } from "@/components/ui/fields"
import { Panel } from "@/components/ui/panel"
import { dxByCode, dxCodes, pxCodes } from "@/domain/catalog"
import { REGIONS } from "@/domain/region"
import type { Diagnosis, Encounter } from "@/domain/types"
import { useActions } from "@/store"
import { useRegion } from "@/store/selectors"
import { CodeSearch } from "./code-search"

type Poa = NonNullable<Diagnosis["poa"]>
const POA_OPTIONS: { value: Poa; label: string }[] = [
  { value: "Y", label: "Y — Present on admission" },
  { value: "N", label: "N — Not present on admission" },
  { value: "U", label: "U — Documentation insufficient" },
  { value: "W", label: "W — Clinically undetermined" },
]

export function DiagnosisSection({ encounter, readOnly }: { encounter: Encounter; readOnly: boolean }) {
  const { setDiagnoses, setProcedures } = useActions()
  const region = useRegion()
  const info = REGIONS[region]
  const dxList = useMemo(() => dxCodes(region), [region])
  const pxList = useMemo(() => pxCodes(region), [region])
  const dx = encounter.diagnoses
  const symptomOnly = dx.find((d) => d.primary)?.code.startsWith("R")
  const showPoa = region === "us" && encounter.kind === "inpatient"
  const pxSystem = region === "us" ? "CPT" : "OPCS-4"

  return (
    <div className="space-y-4">
      <Panel
        title={`Diagnoses (${info.dxSystem})`}
        description={`The first diagnosis becomes the ${region === "us" ? "principal" : "primary"} diagnosis; click the star to change it.`}
      >
        {!readOnly && (
          <div className="mb-3">
            <CodeSearch
              label="Search diagnoses"
              codes={dxList}
              system={info.dxSystem}
              exclude={dx.map((d) => d.code)}
              placeholder="Type a code or term, e.g. I10 or hypertension"
              onPick={(c) => setDiagnoses(encounter.id, [...dx, { code: c.code, display: c.display, primary: dx.length === 0, poa: showPoa ? "Y" : undefined }])}
            />
          </div>
        )}
        {dx.length === 0 ? (
          <p className="text-sm text-muted">No diagnoses yet. A {region === "us" ? "principal" : "primary"} diagnosis is required before the encounter can be closed.</p>
        ) : (
          <ul className="space-y-2">
            {dx.map((d) => {
              const snomed = dxByCode(region, d.code)?.snomed
              return (
                <li key={d.code} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-secondary px-3 py-2">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    aria-label={d.primary ? "Principal diagnosis" : "Make principal diagnosis"}
                    isDisabled={readOnly}
                    onPress={() => setDiagnoses(encounter.id, dx.map((x) => ({ ...x, primary: x.code === d.code })))}
                  >
                    <Star className={d.primary ? "size-4 fill-warning text-warning" : "size-4 text-muted"} />
                  </Button>
                  <span className="tabular w-20 font-semibold">{d.code}</span>
                  <span className="min-w-0 flex-1 text-sm">
                    {d.display}
                    <span className="num mt-0.5 block text-[11px] text-muted">
                      {info.dxSystem}
                      {snomed && ` · SNOMED CT ${snomed}`}
                    </span>
                  </span>
                  {showPoa && (
                    <SelectInput
                      label="POA"
                      className="w-28"
                      value={d.poa ?? null}
                      placeholder="—"
                      isDisabled={readOnly}
                      onChange={(poa) => setDiagnoses(encounter.id, dx.map((x) => (x.code === d.code ? { ...x, poa } : x)))}
                      options={POA_OPTIONS}
                    />
                  )}
                  {d.primary && (
                    <Chip size="sm" color="accent" variant="soft">
                      {region === "us" ? "Principal" : "Primary"}
                    </Chip>
                  )}
                  {!readOnly && (
                    <Button
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove ${d.code}`}
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
              )
            })}
          </ul>
        )}
        {symptomOnly && (
          <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-soft-foreground">
            The {region === "us" ? "principal" : "primary"} diagnosis is a symptom code (R chapter).{" "}
            {region === "us"
              ? "Code the confirmed condition when established — symptom codes group to low-weight DRGs and draw medical-necessity denials."
              : "Record the confirmed condition when established — symptom codes group to low-value HRGs and weaken SUS data quality."}
          </p>
        )}
        {showPoa && <p className="label-caps mt-3 text-muted">POA indicator · CMS ICD-10-CM Official Guidelines, Appendix I</p>}
      </Panel>

      <Panel title={`Procedures (${pxSystem})`}>
        {!readOnly && (
          <div className="mb-3">
            <CodeSearch
              label="Search procedures"
              codes={pxList}
              system={pxSystem}
              exclude={encounter.procedures.map((p) => p.code)}
              placeholder={region === "us" ? "e.g. 93000 or electrocardiogram" : "e.g. H01.9 or appendix"}
              onPick={(c) => setProcedures(encounter.id, [...encounter.procedures, { code: c.code, display: c.display }])}
            />
          </div>
        )}
        {encounter.procedures.length === 0 ? (
          <p className="text-sm text-muted">No procedures recorded.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {encounter.procedures.map((p) => (
              <Chip key={p.code} variant="soft">
                <b className="tabular">
                  {pxSystem} {p.code}
                </b>{" "}
                {p.display}
                {!readOnly && (
                  <button type="button" aria-label={`Remove ${p.code}`} className="ml-1" onClick={() => setProcedures(encounter.id, encounter.procedures.filter((x) => x.code !== p.code))}>
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
