# Medisphere — Plan → Roast → Plan v2 → Plan v3 (US + UK/EU)

Research: [`RESEARCH.md`](RESEARCH.md).
Constraints: frontend only (React + HeroUI v3), no backend, mock data, production quality.
Core idea: **modular SaaS** — a facility starts with a few modules and adds more as it grows.
This build is deliberately **full-feature**; it will be trimmed later.

---

## 1. Plan v1 (first draft)

1. One big menu with every hospital module.
2. Admins tick purchased modules in settings.
3. Every module is a CRUD page (table + form).
4. One dashboard for everyone.
5. Data in `localStorage`.

## 2. Roast of v1 (before building)

| # | Problem | Why it fails in a hospital | Fix |
|---|---|---|---|
| 1 | Modules as checkboxes | Turning on Claims without Billing/EHR gives unusable screens | Module catalog with hard `requires` and soft `enhances`; enabling pulls dependencies, disabling is blocked while needed |
| 2 | Everything on from day one | A clinic drowns in an academic medical center's menu | Two-step onboarding (facility type → minimal starter set); disabled modules disappear completely |
| 3 | CRUD pages | Staff work from **queues**, not empty forms | Every clinical module is a worklist (who's next, how long waiting, what's overdue) |
| 4 | One dashboard | Physicians, nurses, cashiers and coders ask different questions | Role home pages built only from enabled modules |
| 5 | No patient safety | Misidentification and allergies cause most preventable harm | Two-identifier banner/wristband, CDS on orders, NEWS2, critical values, surgical checklist, high-alert double check |
| 6 | Cashier keys in charges | Missed charges = revenue leakage | Every service posts its own charge |
| 7 | Payers ignored | Most revenue comes through payers | Eligibility, coding, grouping, claim lifecycle |
| 8 | No interfaces | Hospitals live on HL7/FHIR feeds | Interface queue with actionable errors and retry |
| 9 | Shared workstations | Nurse stations are shared all shift | Screen lock, role switch, autosaved drafts |
| 10 | `localStorage` | Several MB of demo data exceeds quota | IndexedDB, debounced writes, cross-tab sync (TV queue display) |

## 3. Plan v2 (built first, Indonesia)

21 modules (2 core + 19 optional) in 8 categories, 5 facility presets, 10 roles, end-to-end
clinical flow, quality, reports, integrations and access settings. A post-build roast fixed data
credibility (sex/age-appropriate cases, realistic NEWS2 prevalence, consistent occupancy),
workflow friction (one-tap "call next"), and in-flight work warnings when disabling modules.

---

## 4. Plan v3 — re-targeting to the US and UK/Europe

Product decision: drop the Indonesian market; **US is the default**, **UK/Europe (NHS model)** is
the second market pack. English UI. The UI must show real standards and real cases.

### Roast of v2 against US/UK practice

See the gap table in [`RESEARCH.md` §2](RESEARCH.md#2-gap-review-of-v1-indonesia-build-against-usuk-practice).
The short version: payers, triage, coding, claims, integrations and quality measures were all
Indonesia-specific, and several features US/UK hospitals treat as table stakes were missing
(sepsis bundles, BCMA, observation status, eligibility/prior auth, denials, code status,
access audit).

### What v3 changes

- **Region model** (`src/domain/region.ts`): one codebase, two market packs, chosen at onboarding.
  Everything market-specific reads the region — codes, units, currency, date/time format,
  triage scale, payer list, interfaces, measures, wording (e.g. BID vs BD, OR vs theatre).
- **Real reference data**: ICD-10-CM / WHO ICD-10 with SNOMED CT, CPT / OPCS-4, LOINC with
  conventional and SI ranges, CPT-billed lab panels with tube types, UB-04 revenue codes,
  MS-DRG with relative weights and GMLOS (approximate, labelled), HRG4+ families, ATC-coded
  formulary with DEA / UK CD schedules and ISMP high-alert flags, CARC denial codes.
- **New clinical features**: sepsis screen + SEP-1 / Sepsis Six bundle timer; Morse & Braden;
  BCMA on the eMAR; code status (Full/DNR/DNI, DNACPR); critical-value read-back; observation
  status; discharge planning (EDD vs GMLOS, barriers, NCTR, Medicare IM notice).
- **Revenue cycle**: eligibility (270/271) and PDS trace at registration; prior authorisation;
  837/835 lifecycle with denials and appeals; UK clinical coding → HRG → SUS+; private patient billing.
- **Interoperability**: HL7 v2 ADT/ORM/ORU log, FHIR R4 US Core / UK Core resources viewable per
  patient, X12, Surescripts, PDS, EPS, SUS+.
- **Governance**: access audit with break-the-glass (HIPAA / UK GDPR); harm-graded incident
  reporting with external-reporting guidance (PSO / Joint Commission vs LFPSE / PSIRF).
- **Demo data**: a believable day in a US or UK hospital (ED boarding, deteriorating ward
  patients, denials), with valid identifier formats that never point at real people.

### Deliberately not built (yet)

Authentication/SSO and server-side authorisation, multi-tenant, GL/accounting, dietetics,
sterile services, blood bank, telehealth, patient portal, certified e-signature, device
integration (ASTM/HL7 instruments), PACS/DICOM viewer, payroll, CDS Hooks, eCQM (QRDA) export.

## 5. Suggested trimming

1. **Clinic pack**: Registration, EHR, Ambulatory, Pharmacy, Patient Accounting (+ Eligibility, Interop).
2. **Community hospital pack**: + ED, Inpatient, Nursing, Lab.
3. **Add-ons**: Coding & Claims, Imaging, Perioperative, Supply Chain, Workforce, Quality, Analytics.
