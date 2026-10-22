/**
 * Patient accounting & claims.
 */
import { expectedFfs, groupEncounter, grouperFor, isSelfPay } from "@v2/domain/finance"
import type { ClaimStatus, Denial, Encounter, PaymentMethod } from "@v2/domain/types"
import { uid } from "@v2/lib/id"
import { audit, ensureInvoice, findEncounter, nowIso, patientName, queueSync, regionOf, type Draft, type SetFn } from "../helpers"

/** Insured encounters become claims when they close; the account moves to "claim". */
export function createClaimIfNeeded(d: Draft, enc: Encounter) {
  if (isSelfPay(enc.payer)) return
  const inv = ensureInvoice(d, enc)
  inv.status = "claim"
  inv.closedAt = nowIso()
  if (d.claims.some((c) => c.encounterId === enc.id)) return
  const region = regionOf(d)
  const patient = d.patients.find((p) => p.id === enc.patientId)
  d.claims.push({
    id: uid("clm"),
    number: region === "us" ? `2${Date.now().toString().slice(-12)}` : `SUS-${Date.now().toString().slice(-7)}`,
    encounterId: enc.id,
    invoiceId: inv.id,
    payer: enc.payer,
    payerName: region === "uk" && enc.payer === "nhs" ? "NHS England (via ICB commissioner)" : patient?.coverage?.payerName ?? "—",
    grouper: grouperFor(enc, region),
    billed: inv.charges.reduce((s, c) => s + c.qty * c.price, 0),
    status: "draft",
    updatedAt: nowIso(),
  })
}

export function financeActions(set: SetFn) {
  return {
    addPayment(invoiceId: string, method: PaymentMethod, amount: number) {
      set((d) => {
        const inv = d.invoices.find((i) => i.id === invoiceId)
        if (!inv || amount <= 0) return
        inv.payments.push({ id: uid("pay"), at: nowIso(), method, amount, by: d.session.userId })
        const total = inv.charges.reduce((s, c) => s + c.qty * c.price, 0)
        const paid = inv.payments.reduce((s, p) => s + p.amount, 0)
        if (paid >= total) {
          inv.status = "paid"
          inv.closedAt = nowIso()
        }
        audit(d, "Posted payment", `${inv.number} · ${method}`)
      })
    },

    removeCharge(invoiceId: string, chargeId: string) {
      set((d) => {
        const inv = d.invoices.find((i) => i.id === invoiceId)
        if (!inv || inv.status !== "open") return
        const c = inv.charges.find((x) => x.id === chargeId)
        inv.charges = inv.charges.filter((x) => x.id !== chargeId)
        audit(d, "Reversed charge", `${inv.number}: ${c?.description ?? chargeId}`)
      })
    },

    /** Runs the grouper on the current coding (line-item claims take expected reimbursement). */
    groupClaim(claimId: string) {
      set((d) => {
        const claim = d.claims.find((c) => c.id === claimId)
        if (!claim) return
        const enc = findEncounter(d, claim.encounterId)
        const inv = d.invoices.find((i) => i.id === claim.invoiceId)
        const billed = inv ? inv.charges.reduce((s, c) => s + c.qty * c.price, 0) : 0
        claim.billed = billed
        if (claim.grouper === "FFS") {
          claim.tariff = regionOf(d) === "us" ? expectedFfs(billed, claim.payer) : billed
        } else {
          const g = groupEncounter(enc, regionOf(d))
          if (!g) return
          Object.assign(claim, { groupCode: g.code, groupName: g.name, weight: g.weight, gmlos: g.gmlos, tariff: g.tariff })
        }
        claim.status = "coded"
        claim.updatedAt = nowIso()
        audit(d, "Grouped claim", `${claim.grouper} ${claim.groupCode ?? ""}`.trim())
      })
    },

    /** Moves a claim along: submit (837 / SUS+), accept, pay, deny (with CARC), appeal. */
    setClaimStatus(claimId: string, status: ClaimStatus, opts: { note?: string; denial?: Denial } = {}) {
      set((d) => {
        const claim = d.claims.find((c) => c.id === claimId)
        if (!claim) return
        claim.status = status
        claim.note = opts.note ?? claim.note
        if (opts.denial) claim.denial = opts.denial
        if (status === "paid") claim.paid = claim.tariff
        claim.updatedAt = nowIso()
        if (status === "submitted") {
          const kind = findEncounter(d, claim.encounterId).kind
          if (regionOf(d) === "us") queueSync(d, "x12", kind === "inpatient" ? "837I" : "837P", claim.encounterId)
          else if (claim.grouper === "HRG") queueSync(d, "sus", "CDS 6.3 APC/AE", claim.encounterId)
        }
        audit(d, `Claim ${status}`, patientName(d, findEncounter(d, claim.encounterId).patientId))
      })
    },
  }
}
