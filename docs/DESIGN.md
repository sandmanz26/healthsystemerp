# Design language — "Bedside Chart"

> Role: senior product designer. Goal: Medisphere must not look like a SaaS dashboard template.
> Its identity comes from **objects hospital staff read every day** — so it is distinctive and
> instantly understood.

## 1. Principles

1. **Borrow from the ward, not from a template.** Every signature element has a physical
   counterpart: chart paper, the patient wristband, the bedside monitor, the triage tag, the
   queue ticket, the dividers of a paper chart binder.
2. **Colour is clinical information, not decoration.** Strong colour is reserved for existing
   hospital conventions (wristband alert colours, monitor parameter colours, triage colours).
   Everything else is ink on paper.
3. **Numbers read like instruments.** MRNs, clocks, vital signs, codes and durations use tabular
   mono — aligned and unambiguous (0/O, 1/l).
4. **Status is always text + colour.** Nothing is conveyed by colour alone.
5. **Neutral first, colour for meaning.** White/blue or black/white UI; a dedicated low-glare dark
   theme for night shift.
6. **Show the standard.** Codes are printed with their system (ICD-10-CM, LOINC, CPT, MS-DRG,
   ESI, NEWS2, HL7) as small mono captions, so clinicians and implementers can trust what they see.

## 2. Foundations

| Token | Blue-white (default) | Black-white | Dark (night shift) |
|---|---|---|---|
| Background | `oklch(0.982 0.004 255)` near-white | `oklch(0.982 0 0)` | navy `oklch(0.165 0.014 262)` |
| Cards & sidebar | pure white | pure white | `oklch(0.2 0.016 262)` |
| Ink | navy-black `oklch(0.22 0.025 262)` | black `oklch(0.18 0 0)` | `oklch(0.95 0.005 255)` |
| Accent | medical blue `oklch(0.55 0.2 260)` | black | light blue `oklch(0.68 0.17 258)` |

Clinical colours stay coloured in every scheme (alert bands, triage, monitor, status) because
they carry patient-safety meaning.

**Typography** — three roles, three faces: *Bricolage Grotesque* for headings and patient
names; *Plus Jakarta Sans* for interface text; *JetBrains Mono* for clinical numbers, codes and
`label-caps` form headers.

**Surfaces** — paper cards with 1px hairlines, no shadows; ledger-style tables (mono caps
headers, thin rules); status chips like ink stamps.

## 3. Signature components

| Component | Physical counterpart | Rules |
|---|---|---|
| **Wristband** (`Wristband`) | Patient ID band | White band with a barcode strip (scanned at BCMA, specimen collection); two identifiers always visible — name + DOB, plus MRN and, in the UK, the NHS number (3-3-4); clip-on alert bands in the US standardised colours — **red allergy, yellow fall risk, purple DNR** (UK: DNACPR) — plus contact isolation. |
| **Monitor** (`VitalsMonitor`) | Bedside monitor | Always dark; HR green, SpO₂ cyan, NIBP red, RR yellow, temperature orange (°F in the US, °C in the UK); trends per parameter; abnormal = inverted tile (no blinking); NEWS2 as the sixth tile with the protocol response. |
| **Queue ticket** (`QueueTicket`) | Thermal ticket | Notched sides; used on worklists, registration and the waiting-room TV. |
| **Triage tag** (`TriageTag`) | Punched triage tag | Red / orange / yellow / green / blue + number + label; ESI v5 in the US, Manchester Triage in the UK. |
| **Bed** (bed board) | Ward floor plan | Top-down bed: headboard, pillow, blanket; blanket colour = status, hatching = unusable; bed type shown (Med/Surg, Telemetry, ICU, Isolation). |
| **Binder** (sidebar) | Chart binder with dividers | White sidebar, module categories marked by small coloured rules. |
| **Module slots** | Cartridge slots | The modular concept made visible in the sidebar and onboarding. |
| **Shift indicator** | Charge-nurse board | Day 07–19 / Night 19–07, clock and time to handover. |
| **Readout** (`Stat`) | Nurse-station whiteboard | Mono caps label, big number, tone rule on the left. |
| **Chart paper** (`bg-grid`) | ECG paper | Only on "canvas" areas: shift board, next patient, empty states, TV display. |

## 4. Screen patterns

- **Worklist = queue.** Clinics show the *next patient* as the hero with one big button
  (Call → Start visit); the rest are tickets in an aligned subgrid.
- **ED = triage lanes.** One lane per acuity level (+ "awaiting triage"), cards with timers,
  door-to-provider (US) or 4-hour clock (UK), sepsis badge with bundle progress.
- **Inpatient = ward floor plan.** Beds per unit; high NEWS2 frames the bed; observation and
  EDD badges.
- **Home = shift board.** Greeting, role, clock and shift remaining, then the role's worklist.

## 5. Accessibility

- High-contrast pairs (dark ink on paper, monitor colours on dark panel); a formal tool-based
  contrast audit is still to be done before production.
- Every colour marker (bands, triage, bed status) also carries text / label / `aria-label`.
- The only animation is the monitor's live dot, disabled under `prefers-reduced-motion`.
- Touch targets ≥ 32px; layouts tested without horizontal scroll at 390px.

## 6. Where the code lives

- Tokens & global overrides: `src/index.css`
- Signature components: `src/components/clinical/*`
- Shell: `src/app/sidebar.tsx`, `src/app/topbar.tsx`, `src/app/shift-indicator.tsx`, `src/app/logo.tsx`
- Page primitives: `src/components/ui/{page,panel,stat,empty}.tsx`
