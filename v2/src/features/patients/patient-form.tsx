/**
 * New / edit patient (master patient index). Fields follow the market:
 *
 * - US: payer class + coverage (payer, plan, member ID, group) as captured for the X12 270
 *   eligibility request, and the primary care provider.
 * - UK: NHS number (Modulus 11 check digit), registered GP practice, and NHS / private /
 *   overseas-visitor status.
 *
 * It warns about likely duplicates (same NHS number or member ID, or same name + date of
 * birth) before a second record is created — duplicate records are one of the most common
 * MPI data-quality problems in hospitals.
 */
import { Button } from "@heroui/react"
import { AlertTriangle, Plus, X } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import { Dialog } from "@v2/components/ui/dialog"
import { SelectInput, TextInput } from "@v2/components/ui/fields"
import { formatNhsNumber, isValidNhsNumber } from "@v2/domain/interop"
import { REGIONS } from "@v2/domain/region"
import type { Allergy, CodeStatus, Gender, Patient, PayerType } from "@v2/domain/types"
import { formatDate } from "@v2/lib/format"
import { toast } from "@v2/lib/toast"
import { useActions, useStore } from "@v2/store"
import { useRegion } from "@v2/store/selectors"
import { CheckField } from "./patient-fields"
import { ALLERGY_TYPE_OPTIONS, codeStatusOptions, isValidMbi, isValidPostcode, isValidZip, payerOptions, SEVERITY_OPTIONS } from "./patient-options"

interface PatientFormProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  /** Edit mode when provided. */
  patient?: Patient
  initialName?: string
  onSaved?: (patientId: string) => void
}

interface FormState {
  name: string
  gender: Gender | null
  birthDate: string
  phone: string
  address: string
  postcode: string
  preferredLanguage: string
  interpreter: boolean
  nextOfKin: string
  nhsNumber: string
  payer: PayerType
  payerName: string
  plan: string
  memberId: string
  group: string
  primaryCare: string
  codeStatus: CodeStatus
  advanceDirective: boolean
  allergies: Allergy[]
}

function initial(region: "us" | "uk", patient?: Patient, name = ""): FormState {
  return {
    name: patient?.name ?? name,
    gender: patient?.gender ?? null,
    birthDate: patient ? patient.birthDate.slice(0, 10) : "",
    phone: patient?.phone ?? "",
    address: patient?.address ?? "",
    postcode: patient?.postcode ?? "",
    preferredLanguage: patient?.preferredLanguage ?? "English",
    interpreter: patient?.flags?.includes("interpreter") ?? false,
    nextOfKin: patient?.nextOfKin ?? "",
    nhsNumber: patient?.nhsNumber ? formatNhsNumber(patient.nhsNumber) : "",
    payer: patient?.payer ?? (region === "us" ? "commercial" : "nhs"),
    payerName: patient?.coverage?.payerName ?? "",
    plan: patient?.coverage?.plan ?? "",
    memberId: patient?.coverage?.memberId ?? "",
    group: patient?.coverage?.group ?? "",
    primaryCare: patient?.primaryCare ?? "",
    codeStatus: patient?.codeStatus ?? "full",
    advanceDirective: patient?.advanceDirective ?? false,
    allergies: patient?.allergies ?? [],
  }
}

/** Coverage is captured for every payer except self-pay (US) and NHS-funded care (UK). */
const needsCoverage = (p: PayerType) => p === "medicare" || p === "medicaid" || p === "commercial" || p === "private"

function validate(f: FormState, region: "us" | "uk"): Partial<Record<keyof FormState, string>> {
  const e: Partial<Record<keyof FormState, string>> = {}
  if (f.name.trim().split(/\s+/).length < 2) e.name = "Enter first and last name as on photo ID"
  if (!f.gender) e.gender = "Select sex"
  if (!f.birthDate) e.birthDate = "Date of birth is required"
  else if (new Date(f.birthDate) > new Date()) e.birthDate = "Date of birth cannot be in the future"
  if (f.postcode.trim()) {
    if (region === "us" && !isValidZip(f.postcode)) e.postcode = "ZIP code must be 5 digits (or ZIP+4)"
    if (region === "uk" && !isValidPostcode(f.postcode)) e.postcode = "Enter a valid UK postcode, e.g. LS1 3EX"
  }
  if (region === "uk") {
    if (f.nhsNumber.trim() && !isValidNhsNumber(f.nhsNumber)) e.nhsNumber = "Not a valid NHS number (Modulus 11 check digit fails)"
    if (f.payer === "nhs" && !f.nhsNumber.trim()) e.nhsNumber = "NHS number required for NHS-funded care — trace on PDS if unknown"
  }
  if (needsCoverage(f.payer)) {
    if (!f.payerName.trim()) e.payerName = region === "us" ? "Payer name is required" : "Insurer is required"
    if (!f.memberId.trim()) e.memberId = region === "us" ? "Member ID is required for eligibility (270)" : "Membership number is required"
    else if (f.payer === "medicare" && f.payerName.trim().toLowerCase() === "medicare" && !isValidMbi(f.memberId)) e.memberId = "Not a valid MBI (11 characters, e.g. 1EG4-TE5-MK73)"
  }
  return e
}

export function PatientForm({ isOpen, onOpenChange, patient, initialName, onSaved }: PatientFormProps) {
  const region = useRegion()
  const patients = useStore((s) => s.patients)
  const { createPatient, updatePatient, setCodeStatus } = useActions()
  const [form, setForm] = useState<FormState>(() => initial(region, patient, initialName))
  const [submitted, setSubmitted] = useState(false)
  const errors = validate(form, region)
  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))
  const us = region === "us"

  const duplicates = useMemo(() => {
    if (patient) return []
    const nhs = form.nhsNumber.replace(/\s/g, "")
    const member = form.memberId.trim().toLowerCase()
    return patients.filter(
      (p) =>
        (nhs.length === 10 && p.nhsNumber === nhs) ||
        (member.length >= 6 && p.coverage?.memberId.toLowerCase() === member) ||
        (form.birthDate && p.birthDate.slice(0, 10) === form.birthDate && p.name.toLowerCase() === form.name.trim().toLowerCase()),
    )
  }, [patients, form.nhsNumber, form.memberId, form.birthDate, form.name, patient])

  const setPayer = (payer: PayerType) =>
    setForm((f) => ({
      ...f,
      payer,
      payerName: payer === "medicare" && !f.payerName ? "Medicare" : f.payerName,
      plan: payer === "medicare" && !f.plan ? "Part A & B (traditional)" : f.plan,
    }))

  const save = () => {
    setSubmitted(true)
    if (Object.keys(errors).length) return
    const otherFlags = (patient?.flags ?? []).filter((x) => x !== "interpreter")
    const coverage = needsCoverage(form.payer)
      ? { payerName: form.payerName.trim(), plan: form.plan.trim() || undefined, memberId: form.memberId.trim(), group: form.group.trim() || undefined }
      : form.payer === "overseas"
        ? { payerName: "Overseas visitor — chargeable", plan: "NHS (Charges to Overseas Visitors) Regulations 2015", memberId: patient?.coverage?.memberId ?? `OVS-${Date.now().toString().slice(-6)}` }
        : undefined
    const data = {
      name: form.name.trim(),
      gender: form.gender!,
      birthDate: new Date(form.birthDate).toISOString(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      postcode: form.postcode.trim().toUpperCase(),
      preferredLanguage: form.preferredLanguage.trim() || undefined,
      nhsNumber: us ? undefined : form.nhsNumber.replace(/\s/g, "") || undefined,
      payer: form.payer,
      coverage,
      primaryCare: form.primaryCare.trim() || undefined,
      nextOfKin: form.nextOfKin.trim() || undefined,
      advanceDirective: form.advanceDirective,
      flags: form.interpreter ? [...otherFlags, "interpreter" as const] : otherFlags,
      allergies: form.allergies,
    }
    if (patient) {
      updatePatient(patient.id, data)
      if (patient.codeStatus !== form.codeStatus) setCodeStatus(patient.id, form.codeStatus)
      toast.success("Demographics updated")
      onSaved?.(patient.id)
    } else {
      const id = createPatient({ ...data, codeStatus: form.codeStatus })
      toast.success("Patient registered", { description: data.name })
      onSaved?.(id)
    }
    onOpenChange(false)
  }

  const err = (k: keyof FormState) => (submitted ? errors[k] : undefined)
  const nhsDigits = form.nhsNumber.replace(/\s/g, "")

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={false}
      size="lg"
      title={patient ? "Edit demographics" : "New patient"}
      description={us ? "Enter details exactly as on photo ID and insurance card. * Required." : "Enter details as on the PDS record. * Required."}
      footer={
        <>
          <Button variant="tertiary" onPress={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onPress={save}>
            {patient ? "Save changes" : "Register patient"}
          </Button>
        </>
      }
    >
      {duplicates.length > 0 && (
        <div className="flex gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning-soft-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <b>Possible duplicate record.</b> Existing:{" "}
            {duplicates.map((d) => `${d.name} (MRN ${d.mrn}, DOB ${formatDate(d.birthDate)})`).join("; ")}. Check before creating a new MRN.
          </div>
        </div>
      )}

      <FormSection title="Demographics">
        <TextInput label="Full legal name" value={form.name} onChange={set("name")} isRequired error={err("name")} className="sm:col-span-2" autoFocus />
        <SelectInput
          label={us ? "Sex assigned at birth" : "Sex"}
          value={form.gender}
          onChange={set("gender")}
          isRequired
          error={err("gender")}
          placeholder="Select…"
          options={[
            { value: "female", label: "Female" },
            { value: "male", label: "Male" },
          ]}
        />
        <TextInput label="Date of birth" type="date" value={form.birthDate} onChange={set("birthDate")} isRequired error={err("birthDate")} />
        {!us && (
          <TextInput
            label="NHS number"
            value={form.nhsNumber}
            onChange={(v) => set("nhsNumber")(formatNhsNumber(v.replace(/[^\d\s]/g, "").slice(0, 12)))}
            inputMode="numeric"
            isRequired={form.payer === "nhs"}
            error={err("nhsNumber")}
            description={nhsDigits.length === 10 ? (isValidNhsNumber(nhsDigits) ? "Check digit valid (Modulus 11)" : "Check digit invalid") : "10 digits, shown 3 3 4"}
          />
        )}
        <TextInput label="Phone" type="tel" value={form.phone} onChange={set("phone")} inputMode="tel" placeholder={us ? "(614) 555-0100" : "07700 900123"} />
        <TextInput label="Address" value={form.address} onChange={set("address")} className="sm:col-span-2" />
        <TextInput label={us ? "ZIP code" : "Postcode"} value={form.postcode} onChange={set("postcode")} error={err("postcode")} placeholder={us ? "43215" : "LS1 3EX"} />
        <TextInput label="Preferred language" value={form.preferredLanguage} onChange={set("preferredLanguage")} />
        <div className="sm:col-span-2">
          <CheckField isSelected={form.interpreter} onChange={set("interpreter")} description={us ? "Title VI / ACA §1557: qualified medical interpreter at no cost" : "NHS England interpreting guidance: professional interpreter, not family"}>
            Interpreter needed
          </CheckField>
        </div>
        <TextInput label="Next of kin" value={form.nextOfKin} onChange={set("nextOfKin")} placeholder="Name (relationship) · phone" className="sm:col-span-2" />
      </FormSection>

      <FormSection title={us ? "Coverage" : "Funding & GP registration"}>
        <SelectInput label={us ? "Payer class" : "Funding"} value={form.payer} onChange={setPayer} isRequired options={payerOptions(region)} />
        {us ? (
          <TextInput label="Primary care provider" value={form.primaryCare} onChange={set("primaryCare")} placeholder="e.g. Dr. Lisa Moreno, MD — OSU Family Medicine" />
        ) : (
          <TextInput label="Registered GP practice" value={form.primaryCare} onChange={set("primaryCare")} placeholder="e.g. Park Lane Surgery (B86012)" description="Practice name and ODS code" />
        )}
        {needsCoverage(form.payer) && (
          <>
            <TextInput label={us ? "Payer name" : "Insurer"} value={form.payerName} onChange={set("payerName")} isRequired error={err("payerName")} placeholder={us ? "e.g. Aetna" : "e.g. Bupa"} />
            <TextInput label={us ? "Plan" : "Scheme"} value={form.plan} onChange={set("plan")} placeholder={us ? "e.g. Choice POS II" : "e.g. Corporate scheme"} />
            <TextInput
              label={form.payer === "medicare" ? "Member ID / MBI" : us ? "Member ID" : "Membership number"}
              value={form.memberId}
              onChange={set("memberId")}
              isRequired
              error={err("memberId")}
              description={form.payer === "medicare" ? "MBI for traditional Medicare; plan ID for Medicare Advantage" : undefined}
            />
            {us && <TextInput label="Group number" value={form.group} onChange={set("group")} />}
          </>
        )}
        {form.payer === "self-pay" && (
          <p className="text-xs text-muted sm:col-span-2">Uninsured / self-pay: a Good Faith Estimate is required for scheduled services (No Surprises Act, 45 CFR 149.610). Screen for Medicaid and financial assistance.</p>
        )}
        {form.payer === "overseas" && (
          <p className="text-xs text-muted sm:col-span-2">Refer to the Overseas Visitors Manager. Urgent and immediately necessary treatment must not be withheld; A&E and certain infectious-disease care are exempt from charges.</p>
        )}
      </FormSection>

      <FormSection title="Resuscitation status">
        <SelectInput label="Code status" value={form.codeStatus} onChange={set("codeStatus")} isRequired options={codeStatusOptions(region)} />
        <div className="flex items-end pb-1">
          <CheckField isSelected={form.advanceDirective} onChange={set("advanceDirective")}>
            {us ? "Advance directive / POLST on file" : "ReSPECT form on file"}
          </CheckField>
        </div>
      </FormSection>

      <AllergyEditor allergies={form.allergies} onChange={set("allergies")} />
      <p className="label-caps text-muted">
        {REGIONS[region].privacyLaw} · maps to FHIR Patient ({REGIONS[region].fhirProfile})
      </p>
    </Dialog>
  )
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3 border-t border-separator pt-3 first-of-type:border-0 first-of-type:pt-0">
      <legend className="label-caps text-muted">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

function AllergyEditor({ allergies, onChange }: { allergies: Allergy[]; onChange: (a: Allergy[]) => void }) {
  const [substance, setSubstance] = useState("")
  const [reaction, setReaction] = useState("")
  const [severity, setSeverity] = useState<Allergy["severity"]>("moderate")
  const [type, setType] = useState<NonNullable<Allergy["type"]>>("allergy")
  const add = () => {
    if (!substance.trim() || allergies.some((a) => a.substance.toLowerCase() === substance.trim().toLowerCase())) return
    onChange([...allergies, { substance: substance.trim(), reaction: reaction.trim() || "Not specified", severity, type }])
    setSubstance("")
    setReaction("")
  }
  return (
    <fieldset className="space-y-3 border-t border-separator pt-3">
      <legend className="label-caps text-muted">Allergies & intolerances</legend>
      {allergies.length === 0 ? (
        <p className="text-sm text-muted">No known allergies (NKA) recorded. Ask at every visit.</p>
      ) : (
        <ul className="space-y-1.5">
          {allergies.map((a) => (
            <li key={a.substance} className="flex items-center justify-between gap-2 rounded-lg bg-danger-soft px-3 py-1.5 text-sm">
              <span>
                <b className="text-danger">{a.substance}</b> — {a.reaction} · {a.severity}
                {a.type === "intolerance" && " · intolerance"}
              </span>
              <Button isIconOnly size="sm" variant="ghost" aria-label={`Remove ${a.substance}`} onPress={() => onChange(allergies.filter((x) => x !== a))}>
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-3 sm:grid-cols-[1.3fr_1.3fr_1fr_1fr_auto] sm:items-end">
        <TextInput label="Substance" value={substance} onChange={setSubstance} placeholder="e.g. Penicillin" />
        <TextInput label="Reaction" value={reaction} onChange={setReaction} placeholder="e.g. Hives" />
        <SelectInput label="Severity" value={severity} onChange={setSeverity} options={SEVERITY_OPTIONS} />
        <SelectInput label="Type" value={type} onChange={setType} options={ALLERGY_TYPE_OPTIONS} />
        <Button variant="secondary" onPress={add} isDisabled={!substance.trim()}>
          <Plus className="size-4" aria-hidden /> Add
        </Button>
      </div>
    </fieldset>
  )
}
