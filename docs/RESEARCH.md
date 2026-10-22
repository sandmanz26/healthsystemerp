# Research — what a US and a UK/European hospital system must do

This document records the feature review that turned Medisphere from an Indonesia-specific
prototype into a product for **two markets**: the **United States** (default) and the
**United Kingdom / Europe**, modelled on NHS England. It lists what each market requires,
where they differ, what was missing from v1, and how the product now handles it.

> Data in the demo is synthetic (no real patients), but every code, identifier format,
> workflow and rule is the real one. Where numbers are approximations (e.g. MS-DRG weights),
> the UI says so.

## 1. Market differences that change the software

| Area | United States | United Kingdom / Europe (NHS model) | Where in the product |
|---|---|---|---|
| Patient identity | Facility MRN; no national ID. Medicare MBI on the card | MRN + **NHS number** (10 digits, Modulus 11), traced on **PDS** | `domain/interop.ts`, wristband, registration |
| Who pays | Medicare, Medicaid (managed care), commercial plans, self-pay | NHS-funded (no patient bill), private insurers, chargeable overseas visitors | `PayerType`, billing, claims |
| Front-desk check | Real-time eligibility **X12 270/271**, prior auth **278** | **PDS trace**, e-RS referral (UBRN) | registration, `payer` module |
| Diagnosis codes | **ICD-10-CM** (+ POA indicator on inpatient claims) | **WHO ICD-10 5th ed.** + SNOMED CT in the record | `domain/catalog.ts` |
| Procedure codes | **CPT / HCPCS** (+ UB-04 revenue codes) | **OPCS-4.10** | catalog, charges |
| Inpatient payment | **MS-DRG** (relative weight × base rate, GMLOS) | **HRG4+** (NHS Payment Scheme), submitted to **SUS+** | `domain/finance.ts`, claims |
| Claims & denials | 837I/837P → 277CA → **835** with **CARC/RARC** | SUS+ CDS submissions; insurer invoices for private | claims |
| ED triage | **ESI v5** (acuity + resources, no time targets) | **Manchester Triage System** (max wait 0/10/60/120/240 min) | `TRIAGE_SCALES` |
| ED standard | Door-to-provider, LWBS, boarding (CMS OP-18/OP-22) | **4-hour standard** (78% interim target), 12-hour breaches | ED board, measures |
| Sepsis | **CMS SEP-1**: 3-hour & 6-hour bundles | **Sepsis Six** within 1 hour (NICE NG51, UK Sepsis Trust) | sepsis widget |
| Deterioration | NEWS2 / MEWS (system choice) | **NEWS2** mandated (RCP 2017) | vitals, nursing |
| Admission status | **Inpatient vs Observation** (Two-Midnight Rule), Medicare IM notice | Spell; **No Criteria to Reside**, discharge pathways 0–3 | inpatient |
| Resuscitation status | Full code / DNR / DNR-DNI / POLST | DNACPR / ReSPECT | patient banner & wristband |
| Medication safety | ISMP high-alert list, **DEA** schedules + PDMP, **BCMA** (Leapfrog) | ISMP/NPSA alerts, **Misuse of Drugs Regs** CD schedules, CD register | pharmacy, eMAR |
| e-Prescribing | **Surescripts** NewRx | **EPS** (Electronic Prescription Service) | `payer` module |
| Interoperability | HL7 v2, **FHIR R4 US Core 6.1.0**, USCDI v3 (ONC HTI-1), SMART on FHIR | HL7 v2, **FHIR UK Core**, GP Connect, MESH | `interop` module |
| Units | Conventional (mg/dL), °F, lb, 12-hour clock, $ | **SI** (mmol/L, µmol/L), °C, kg, 24-hour clock, £ | `lib/format.ts`, `rangeFor` |
| Spelling & wording | ED, OR, cesarean, "BID" | A&E/ED, theatre, caesarean, "BD/TDS/OD" | `FREQUENCIES`, labels |
| Privacy | **HIPAA** (audit controls 45 CFR §164.312(b)), break-the-glass | **UK GDPR / DPA 2018**, NHS DSP Toolkit, Caldicott | access audit |
| Patient safety reporting | AHRQ **Common Formats** to a PSO; Joint Commission **sentinel events** | **LFPSE**, **PSIRF** responses, **Duty of Candour**, Never Events | quality |
| Quality measures | CMS IQR/OQR (SEP-1, HCAHPS, readmissions, HAC), Joint Commission NPSGs, NDNQI, NHSN | Constitutional standards (4-hour, RTT 18 weeks), Safety Thermometer, FFT, NICE quality standards | `MEASURES` |
| Workforce | State licence, **NPI**, DEA, BLS/ACLS | **GMC/NMC/GPhC/HCPC** registration, Resus Council ILS/ALS | workforce |

Continental Europe follows the UK pack for most of these (WHO ICD-10, SI units, MTS, GDPR,
24-hour clock); country code sets such as G-DRG/OPS (Germany) or GHM/CCAM (France) slot into
the same catalog interfaces.

## 2. Gap review of v1 (Indonesia build) against US/UK practice

| # | Gap found | Severity | Resolution |
|---|---|---|---|
| 1 | Payers were BPJS / Umum / Asuransi; no Medicare/Medicaid/commercial or NHS | Blocker | New payer model + coverage (payer, plan, member ID, group) |
| 2 | Triage used the Australasian scale | High | ESI v5 (US) and Manchester Triage (UK) with their real criteria |
| 3 | No sepsis pathway — the most audited inpatient measure in the US | High | Sepsis screen (SEP-1 / red-flag), bundle checklist with live countdown |
| 4 | Lab results in one unit system, local test codes | High | LOINC codes, conventional *and* SI ranges, panel ordering billed by CPT |
| 5 | Claims were iDRG/INA-CBG with Indonesian "pending" | Blocker | MS-DRG grouping, 837/835, CARC denials & appeals; UK HRG + SUS+ |
| 6 | No eligibility / prior authorisation | High | 270/271 and PDS trace at registration; prior auth on admissions, imaging & elective surgery |
| 7 | No observation status | High (US) | Inpatient vs observation with Two-Midnight hint; observation billed hourly (G0378) |
| 8 | eMAR without barcode scanning | High | BCMA: scan wristband + dose, five rights, witness for high-alert drugs, override reason |
| 9 | No nursing risk scales | Medium | Morse Fall Scale and Braden Scale with risk-based interventions |
| 10 | DNR as a wristband only | Medium | Code status on the patient (Full/DNR/DNR-DNI/Comfort; UK DNACPR) + advance directive |
| 11 | Critical values without documented call-back | Medium | Read-back documentation (Joint Commission NPSG.02.03.01) |
| 12 | Integration only to SATUSEHAT | Blocker | HL7 v2 ADT/ORM/ORU log, FHIR R4 US Core / UK Core resources, X12, Surescripts, PDS, EPS, SUS+ |
| 13 | No discharge planning | Medium | EDD vs GMLOS, discharge barriers, medically ready / NCTR, Medicare IM notice |
| 14 | Incident grading used the Indonesian KKPRS matrix | Medium | Harm levels (AHRQ / LFPSE), 5×5 risk matrix, external-reporting guidance |
| 15 | Quality indicators were Indonesia's INM | High | CMS / Joint Commission measures (US); NHS standards (UK) with sources |
| 16 | Staff licences were STR/SIP | Medium | State licence + NPI + DEA + BLS/ACLS; GMC/NMC/GPhC/HCPC + ILS/ALS |
| 17 | No privacy audit view | High | Access audit with break-the-glass review (HIPAA / UK GDPR) |
| 18 | Indonesian UI and Rupiah | Blocker | English UI, region-aware money, dates, temperature, weight |

## 3. Real cases in the demo

The demo hospital's day is generated from guideline-based scenarios, for example:

- **ED sepsis** — elderly COPD patient, CAP with hypotension, CURB-65 4; SEP-1 clock running
  with lactate, cultures and antibiotics done and fluids still due.
- **Stroke alert** — LKW 50 min, NIHSS 9, CT without haemorrhage, alteplase within the window.
- **NSTEMI** — ST depression V4–V6, hs-troponin rising, heparin per nomogram, HEART 7.
- **Hyperkalaemia in ESRD** — missed dialysis, K⁺ 6.8 with peaked T waves, boarding in the ED
  waiting for a telemetry bed (in the UK build this breaches the 4-hour standard).
- **Ward** — decompensated HFrEF with AKI on telemetry (deteriorating NEWS2), UTI with delirium
  awaiting SNF/care-home placement, hip fracture for hemiarthroplasty with orthogeriatrics,
  syncope and chest pain in **observation** (US).
- **Revenue cycle** — commercial inpatient admission without prior auth denied with
  **CARC CO-197**, appeals in progress, DRG 193/291/871 groupings with GMLOS.

Identifiers use real formats without pointing at real people: NHS numbers in the reserved
999 test range (valid Modulus 11), Luhn-valid NPIs, Medicare MBIs in the CMS character format,
555-01xx US phone numbers and Ofcom drama-range UK mobiles.

## 4. Sources

- CMS SEP-1 bundle requirements: [Medisolv — CMS sepsis measures](https://blog.medisolv.com/articles/cms-sepsis-measures-hvbp), [SEP-1 bundle measure overview](https://casrai.org/guides/sep-1-sepsis-bundle-measure)
- ESI v5: [ENA — ESI resources update (2023)](https://www.ena.org/press-room/articles/detail/2023/04/25/ena-updates-emergency-severity-index-resources-to-improve-patient-triage)
- Manchester Triage System categories & target times: [PMC table](https://pmc.ncbi.nlm.nih.gov/articles/PMC6549628/table/T1), [DOAJ article](https://doaj.org/article/ecbb7d66fafd4b28922f5ec45cc708dc)
- ONC HTI-1 (USCDI v3, US Core): [HTI-1 final rule overview](https://www.healthit.gov/sites/default/files/facas/2024-01-18_HTI-1_Final_Rule_Overview_508.pdf), [HTI-1 fact sheet](https://www.healthit.gov/sites/default/files/page/2023-12/HTI-1_Gen-Overview_factsheet_508.pdf)
- MS-DRG metrics context (weights/GMLOS shape): [Ballad Health MS-DRG metrics](https://www.balladhealth.org/sites/default/files/2026-07/Ballad-Health-Aggregate-MS-DRG-Metrics-072226.pdf)
- NEWS2: Royal College of Physicians, *National Early Warning Score (NEWS) 2*, 2017.
- NICE NG51 *Sepsis: recognition, diagnosis and early management*; UK Sepsis Trust *Sepsis Six*.
- Morse JM. *Morse Fall Scale* (1989); Bergstrom N. *Braden Scale* (1987).
- WHO *Surgical Safety Checklist* (2009); Joint Commission *Universal Protocol*.
- NHS Digital: NHS number Modulus 11 check; CMS: NPI check digit (Luhn with prefix 80840).
