/**
 * Registration-time financial clearance:
 *
 * - US: real-time eligibility (X12 270 request → 271 response through the clearinghouse), and
 *   for self-pay patients a Good Faith Estimate (No Surprises Act, 45 CFR 149.610) plus
 *   financial-assistance screening (IRS 501(r)).
 * - UK: a Spine PDS trace confirming the NHS number and registered GP; overseas visitors get
 *   a chargeable-care estimate (NHS Charges to Overseas Visitors Regulations 2015, 150% of tariff).
 */
import { Button, Chip } from "@heroui/react"
import { CircleDollarSign, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react"
import { TARIFFS } from "@v2/domain/catalog"
import type { Region } from "@v2/domain/region"
import type { Encounter, Patient } from "@v2/domain/types"
import { formatDateTime, formatMoney } from "@v2/lib/format"
import { toast } from "@v2/lib/toast"
import { useActions } from "@v2/store"
import { useModuleEnabled } from "@v2/store/selectors"

export function EligibilityCard({ encounter, patient, region }: { encounter: Encounter; patient: Patient; region: Region }) {
  const payerOn = useModuleEnabled("payer")
  const { verifyEligibility } = useActions()
  const us = region === "us"
  const title = us ? "Eligibility (X12 270/271)" : "PDS trace"
  const elig = encounter.eligibility

  if (us && encounter.payer === "self-pay") return null
  if (!us && encounter.payer !== "nhs") return null

  const rerun = () => {
    verifyEligibility(encounter.id)
    toast.success(us ? "270 sent — 271 received" : "PDS trace complete")
  }

  return (
    <div className="rounded-xl border border-border p-3 text-left">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="label-caps text-muted">{title}</span>
        {payerOn && (
          <Button size="sm" variant="ghost" onPress={rerun}>
            <RefreshCw className="size-3.5" aria-hidden /> Re-run
          </Button>
        )}
      </div>
      {!payerOn ? (
        <p className="text-xs text-muted">{us ? "Payer connectivity is off — verify on the payer portal or by phone and note the reference." : "Spine connectivity is off — trace the NHS number on the PDS portal."}</p>
      ) : !elig ? (
        <p className="flex items-center gap-1.5 text-xs text-warning">
          <ShieldAlert className="size-3.5" aria-hidden />
          {us ? (patient.coverage ? "Not yet verified" : "No coverage on file — add the insurance card or register as self-pay") : "Not traced"}
        </p>
      ) : (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Chip size="sm" variant="soft" color={elig.status === "active" ? "success" : "danger"}>
              {elig.status === "active" ? <ShieldCheck className="size-3.5" aria-hidden /> : <ShieldAlert className="size-3.5" aria-hidden />}
              {us ? (elig.status === "active" ? "Coverage active" : elig.status === "inactive" ? "Coverage inactive" : "Subscriber not found") : elig.status === "active" ? "NHS number verified" : "No PDS match"}
            </Chip>
            {us && patient.coverage && <span className="text-xs text-muted">{patient.coverage.payerName}</span>}
          </div>
          <p className="text-sm">{elig.summary}</p>
          <p className="num text-[11px] text-muted">
            {us ? "271 trace" : "Request ID"} {elig.reference} · {formatDateTime(elig.at)}
          </p>
        </div>
      )}
    </div>
  )
}

/** Self-pay / chargeable estimate shown at registration. Returns null for insured / NHS-funded visits. */
export function CostEstimate({ kind, payer, established, region }: { kind: "outpatient" | "emergency"; payer: Encounter["payer"]; established: boolean; region: Region }) {
  if (payer !== "self-pay" && payer !== "overseas") return null
  const visit = established ? TARIFFS["clinic-est"] : TARIFFS["clinic-new"]
  const edLow = TARIFFS["ed-5"].price[region]
  const edHigh = TARIFFS["ed-1"].price[region]

  if (region === "us")
    return (
      <div className="rounded-xl bg-warning-soft p-3 text-left text-sm text-warning-soft-foreground">
        <div className="mb-1 flex items-center gap-1.5 font-semibold">
          <CircleDollarSign className="size-4" aria-hidden /> {kind === "emergency" ? "Self-pay estimate" : "Good Faith Estimate"}
        </div>
        {kind === "emergency" ? (
          <p>
            ED facility fee <b className="num">{formatMoney(edLow)}–{formatMoney(edHigh)}</b> (CPT 99282–99285) plus professional fees, depending on acuity. The medical screening exam is provided regardless of ability to pay (EMTALA).
          </p>
        ) : (
          <p>
            Office visit CPT {visit.code}: <b className="num">{formatMoney(visit.price.us)}</b>, before labs or imaging. Uninsured self-pay discount and financial assistance screening available.
          </p>
        )}
        <p className="label-caps mt-1.5 opacity-80">No Surprises Act · 45 CFR 149.610 · Financial assistance per IRS 501(r)</p>
      </div>
    )

  return (
    <div className="rounded-xl bg-warning-soft p-3 text-left text-sm text-warning-soft-foreground">
      <div className="mb-1 flex items-center gap-1.5 font-semibold">
        <CircleDollarSign className="size-4" aria-hidden /> Chargeable overseas visitor
      </div>
      {kind === "emergency" ? (
        <p>A&E treatment is exempt from charges. Charges apply from admission onward — refer to the Overseas Visitors Manager.</p>
      ) : (
        <p>
          Estimated outpatient attendance <b className="num">{formatMoney(Math.round(visit.price.uk * 1.5))}</b> (150% of tariff), payable in advance for non-urgent care. Urgent and immediately necessary treatment is never withheld.
        </p>
      )}
      <p className="label-caps mt-1.5 opacity-80">NHS (Charges to Overseas Visitors) Regulations 2015</p>
    </div>
  )
}
