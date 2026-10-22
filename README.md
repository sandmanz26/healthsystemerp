# Medisphere — modular hospital information system (frontend)

A frontend-only, production-quality prototype of a **modular** hospital information system
for the **United States** and the **United Kingdom / Europe** (NHS model). A facility starts with
the few modules it needs and adds more from the **Module Center** as it grows — modules that
are off do not appear anywhere.

- **Stack:** React 19, TypeScript (strict), Vite 7, **HeroUI v3** (React Aria + Tailwind v4),
  Zustand + Immer, React Router 7, Recharts, Vitest.
- **No backend.** A synthetic hospital day is generated for *today* and persisted in IndexedDB.
- **Two market packs, one codebase** (`src/domain/region.ts`): chosen at onboarding, they switch
  code systems, units, currency, triage scale, payers, interfaces, quality measures and wording.

| | United States (default) | UK / Europe (NHS model) |
|---|---|---|
| Codes | ICD-10-CM, CPT/HCPCS, UB-04 revenue codes, LOINC, SNOMED CT | WHO ICD-10, OPCS-4, LOINC, SNOMED CT |
| Payment | MS-DRG, line-item FFS, 837/835, CARC denials | HRG4+, SUS+, private insurer invoices |
| Front door | X12 270/271 eligibility, prior auth | NHS number + PDS trace, e-RS |
| ED | ESI v5, door-to-provider, CMS SEP-1 | Manchester Triage, 4-hour standard, Sepsis Six |
| Interfaces | HL7 v2, FHIR R4 US Core, Surescripts | HL7 v2, FHIR UK Core, EPS, GP Connect, MESH |
| Units | mg/dL, °F, lb, $, 12-hour clock | mmol/L, °C, kg, £, 24-hour clock |
| Privacy / safety | HIPAA, AHRQ Common Formats, Joint Commission | UK GDPR, LFPSE, PSIRF, Duty of Candour |

**Design language — "Bedside Chart":** the UI borrows from objects hospital staff read every day —
chart paper, patient wristbands with alert bands, bedside monitors, triage tags, thermal queue
tickets and the dividers of a chart binder — on a clean white + blue palette (or black & white)
with a low-glare night-shift theme. See [`docs/DESIGN.md`](docs/DESIGN.md).

Process docs: [`docs/RESEARCH.md`](docs/RESEARCH.md) (US vs UK/EU requirements, gap review,
sources) and [`docs/PLAN.md`](docs/PLAN.md) (plan → roast → v2 → v3).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build (static, relative paths)
npm test           # unit tests (clinical rules, identifiers, HL7/FHIR, demo-data invariants per market)
npm run lint
```

On first load you choose the **market**, then a facility type and its suggested modules (or
enable everything for the full demo). Use the avatar menu (top right) to **view the app as any
role**; the lock icon locks a shared workstation (demo PIN `1234`).

## Modules

| Category | Modules |
|---|---|
| Core (always on) | Patient Index (EMPI) · Settings & Access |
| Patient access | Registration & Queue (+ waiting-room display) · Scheduling |
| Clinical | Electronic Health Record · Ambulatory Clinics · Emergency Department · Inpatient & Bed Management · Nursing · Perioperative |
| Diagnostics & pharmacy | Laboratory (LIS) · Imaging (RIS) · Pharmacy |
| Revenue cycle | Patient Accounting · Coding & Claims (UK: Clinical Coding & SUS+) |
| Operations | Supply Chain · Workforce & Credentialing |
| Quality & analytics | Quality & Patient Safety · Analytics |
| Interoperability | Eligibility & Authorization (UK: NHS Spine Services) · Interoperability Hub |

Dependencies (`requires`) are enforced both ways; optional synergies (`enhances`) are shown as
suggestions. See `src/domain/modules.ts`.

## What makes it hospital-shaped

- **Worklists, not menus** — every role's home is its queue, with waiting times and overdue markers.
- **Patient safety** — two-identifier wristband (MRN, DOB, NHS number) with allergy / fall /
  code-status bands; CDS on medication orders (allergy cross-reactivity, interactions, duplication,
  ISMP high-alert, controlled drugs, formulary); NEWS2; sepsis screening with SEP-1 / Sepsis Six
  bundle timers; Morse & Braden; barcode medication administration with witness for high-alert
  drugs; critical-value read-back; WHO Surgical Safety Checklist that gates the case.
- **Money follows care** — every service posts its own CPT/revenue-coded charge; insured visits
  become claims with pre-bill edits, MS-DRG grouping (approximate weights, labelled), denials
  and appeals; NHS activity is coded to HRG and submitted to SUS+.
- **Interoperability you can inspect** — HL7 v2 messages and FHIR R4 resources are generated from
  the record and shown in the UI.
- **Shared workstations & interruptions** — screen lock, role switch, autosaved drafts, access
  audit with break-the-glass.

## Project structure

```
src/
  app/           shell: router, layout, sidebar, top bar, command palette (Ctrl/⌘+K), lock screen
  components/    UI primitives on HeroUI + signature clinical components (wristband, monitor, triage tag)
  domain/        pure rules & types: region packs, catalogs (ICD-10-CM/ICD-10, CPT/OPCS, LOINC, imaging,
                 chargemaster), clinical (NEWS2, triage, sepsis, Morse/Braden, Rx review), finance
                 (claims, MS-DRG/HRG), quality, interop (FHIR, HL7, NHS number, NPI), modules
  data/          master data per market, clinical scenarios, deterministic seed generator
  store/         Zustand store; actions grouped by domain; selectors; IndexedDB storage
  features/      one folder per module (pages + feature components)
docs/            research, plan, design language
```

Conventions: domain code has no React; pages read narrow store selectors and call actions;
cross-module side effects (charges, audit trail, interface messages, notifications) live in
`src/store/helpers.ts`.

## Limits (honest)

Demo only: no authentication or server authorisation; payer, Spine and HIE calls are simulated;
MS-DRG weights, GMLOS and tariffs are approximations for illustration (load the current CMS /
NHS tables in production); CPT descriptors are abbreviated (CPT is licensed by the AMA); clinical
rules are simplified references — this is not a certified medical device or certified EHR.
All patients and staff are fictional.
