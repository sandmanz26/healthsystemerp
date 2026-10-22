/**
 * Radiology building blocks: modality, CPT / revenue codes, prior authorization (US
 * commercial payers & Medicare Advantage) and the structured report editor.
 */
import { Button, Chip } from "@heroui/react"
import { ShieldCheck, ShieldX } from "lucide-react"
import { SelectInput, TextAreaInput } from "@/components/ui/fields"
import type { Region } from "@/domain/region"
import type { AuthStatus, ServiceOrder } from "@/domain/types"
import { toast } from "@/lib/toast"
import { useActions } from "@/store"
import { Code } from "@/features/laboratory/lab-parts"
import { orderExams } from "./rad-utils"

/** Exam list with modality, CPT and UB-04 revenue code. */
export function ExamList({ order }: { order: ServiceOrder }) {
  return (
    <ul className="divide-y divide-separator rounded-xl border border-border">
      {orderExams(order).map((e) => (
        <li key={e.code} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
          <span className="num rounded bg-surface-secondary px-1.5 text-[11px] font-semibold">{e.modality}</span>
          <span className="font-medium">{e.name}</span>
          <Code system="CPT" code={`${e.cpt} · rev ${e.revCode}`} className="ml-auto" />
        </li>
      ))}
    </ul>
  )
}

const AUTH: Record<AuthStatus, { label: string; color: "default" | "warning" | "success" | "danger" }> = {
  "not-required": { label: "No auth required", color: "default" },
  pending: { label: "Auth pending", color: "warning" },
  approved: { label: "Auth approved", color: "success" },
  denied: { label: "Auth denied", color: "danger" },
}

export function AuthChip({ auth }: { auth?: AuthStatus }) {
  if (!auth) return <span className="text-xs text-muted">—</span>
  return (
    <Chip size="sm" variant="soft" color={AUTH[auth].color} className="whitespace-nowrap">
      {AUTH[auth].label}
    </Chip>
  )
}

/** Prior authorization (X12 278) status with the manual outcome buttons used until the payer portal replies. */
export function AuthPanel({ order }: { order: ServiceOrder }) {
  const { setOrderAuth } = useActions()
  if (!order.auth) return null
  return (
    <div className="space-y-2 rounded-xl border border-border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">Prior authorization</span>
        <AuthChip auth={order.auth} />
      </div>
      {order.auth === "pending" && (
        <>
          <p className="text-muted">Advanced imaging for this payer needs pre-certification. Do not schedule the exam until the payer approves.</p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="danger-soft" onPress={() => { setOrderAuth(order.id, "denied"); toast("Authorization marked denied") }}>
              <ShieldX className="size-3.5" aria-hidden /> Mark denied
            </Button>
            <Button size="sm" variant="primary" onPress={() => { setOrderAuth(order.id, "approved"); toast.success("Authorization approved") }}>
              <ShieldCheck className="size-3.5" aria-hidden /> Mark approved
            </Button>
          </div>
        </>
      )}
      {order.auth === "denied" && <p className="text-danger">Denied — contact the ordering provider for a peer-to-peer review or an alternative study.</p>}
      <div className="label-caps text-muted">X12 278 · CMS-0057-F prior authorization</div>
    </div>
  )
}

const T = (exam: string, technique: string, findings: string, impression: string) =>
  `EXAM: ${exam}\nCLINICAL HISTORY: \nTECHNIQUE: ${technique}\nCOMPARISON: None.\n\nFINDINGS:\n${findings}\n\nIMPRESSION:\n${impression}`

const TEMPLATES: Record<string, { label: string; text: (region: Region) => string }> = {
  blank: { label: "Blank structured report", text: () => T("", "", "", "1. ") },
  "xr-chest": {
    label: "Chest XR — normal",
    text: () =>
      T(
        "XR chest, PA and lateral",
        "PA and lateral views.",
        "Lungs: Clear. No focal consolidation, effusion or pneumothorax.\nHeart: Normal size (CTR < 0.5).\nMediastinum: Normal contour.\nBones: No acute osseous abnormality.",
        "1. No acute cardiopulmonary process.",
      ),
  },
  "ct-head": {
    label: "CT head — normal",
    text: () =>
      T(
        "CT head without contrast",
        "Axial images from skull base to vertex without IV contrast.",
        "No acute intracranial hemorrhage, mass effect or midline shift.\nGray-white differentiation preserved. Ventricles and sulci normal for age.\nCalvarium intact.",
        "1. No acute intracranial abnormality.",
      ),
  },
  "us-ruq": {
    label: "US RUQ — cholelithiasis",
    text: () =>
      T(
        "US abdomen, limited (RUQ)",
        "Real-time grayscale and color Doppler imaging.",
        "Gallbladder: Multiple mobile shadowing calculi. Wall 2 mm. No pericholecystic fluid. Sonographic Murphy sign negative.\nCommon bile duct: 4 mm.\nLiver: Normal echotexture.",
        "1. Cholelithiasis without sonographic evidence of acute cholecystitis.",
      ),
  },
}

/** Report editor with FINDINGS / IMPRESSION structure (ACR practice parameter for communication). */
export function RadReportEditor({ value, onChange, region }: { value: string; onChange: (v: string) => void; region: Region }) {
  const missing = ["FINDINGS:", "IMPRESSION:"].filter((h) => !value.includes(h))
  return (
    <div className="space-y-2">
      <SelectInput label="Template" value={null} placeholder="Insert template…" onChange={(k) => onChange(TEMPLATES[k].text(region))} options={Object.entries(TEMPLATES).map(([value, t]) => ({ value, label: t.label }))} />
      <TextAreaInput label="Report" value={value} onChange={onChange} rows={12} placeholder={"FINDINGS:\n…\n\nIMPRESSION:\n1. …"} description={missing.length ? `Missing section: ${missing.join(", ")}` : "Structured report — FINDINGS and IMPRESSION present."} />
    </div>
  )
}
