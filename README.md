# Medisphere — modular hospital & health-center SaaS (frontend)

A frontend-only, production-quality prototype of a **modular** hospital information system
(SIMRS) for Indonesian clinics and hospitals. A facility starts with the few modules it needs
and adds more from the **Module Center** as it grows — modules that are off do not appear
anywhere.

- **Stack:** React 19, TypeScript (strict), Vite 7, **HeroUI v3** (React Aria + Tailwind v4),
  Zustand + Immer, React Router 7, Recharts, Vitest.
- **No backend.** Demo data is generated for *today* and persisted in IndexedDB.
- **UI language:** Indonesian. **Code & comments:** English.

**Design language — "Bedside Chart":** the UI borrows from objects hospital staff read every day —
chart paper, patient wristbands (with allergy / fall-risk / DNR marker bands), bedside monitors,
triage tags, thermal queue tickets and the coloured dividers of a medical-record binder — plus a
"jaga malam" dark theme for night shifts. See [`docs/DESIGN.md`](docs/DESIGN.md).

Process docs (Indonesian): [`docs/RESEARCH.md`](docs/RESEARCH.md) (what a hospital needs, user
behaviour, regulation) and [`docs/PLAN.md`](docs/PLAN.md) (plan → roast → plan v2, plus the
post-build roast and fixes).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build (static, relative paths)
npm test           # unit tests (domain rules + demo-data invariants)
npm run lint
```

On first load you get the onboarding: pick a facility type and its suggested modules, or
**"Aktifkan semua"** for the full demo. Use the avatar menu (top right) to **view the app as
any role**; the lock icon locks a shared workstation (demo PIN `1234`).

## Modules

| Category | Modules |
|---|---|
| Core (always on) | Master Pasien · Pengaturan & Akses |
| Front office | Pendaftaran & Antrean (+ TV queue display) · Jadwal & Janji Temu |
| Clinical | Rekam Medis Elektronik · Rawat Jalan · IGD · Rawat Inap · Keperawatan · Kamar Operasi |
| Support | Laboratorium · Radiologi · Farmasi |
| Finance | Billing & Kasir · Klaim & Casemix |
| Operations | Logistik & Inventori · SDM & Jadwal Jaga |
| Quality | Mutu & Keselamatan Pasien · Laporan & Analitik |
| Integration | Bridging BPJS · SATUSEHAT |

Dependencies (`requires`) are enforced both ways; optional synergies (`enhances`) are shown as
suggestions. See `src/domain/modules.ts`.

## What makes it hospital-shaped

- **Worklists, not menus** — every role's home is its queue; every clinical module is a worklist
  with waiting times and overdue markers.
- **Patient safety** — two-identifier patient banner with allergies everywhere; prescription
  review (allergy cross-reactivity, interactions, duplicates, high-alert, Fornas); NEWS2 with
  the protocol's response; critical lab values with read-back before validation; eMAR with
  double check for high-alert drugs; WHO Surgical Safety Checklist that gates the workflow;
  incident reporting with the KKPRS risk matrix.
- **Money follows care** — every service posts its own charge; BPJS/insurer bills go to claims
  (iDRG grouping estimate, fee-for-service for private insurers, completeness checklist).
- **Shared workstations & interruptions** — screen lock, role switch, autosaved drafts for notes
  and prescriptions.

## Project structure

```
src/
  app/           shell: router, layout, sidebar, top bar, command palette (Ctrl/⌘+K), lock screen
  components/    UI primitives on HeroUI (fields, dialog, side panel, data table, stat, charts)
  domain/        pure rules & types: modules, clinical (NEWS2, triage, Rx review), finance,
                 quality, indicators, catalogs (ICD-10, ICD-9-CM, lab, radiology, tariffs)
  data/          demo master data, clinical scenarios, deterministic seed generator
  store/         Zustand store; actions grouped by domain; selectors; IndexedDB storage
  features/      one folder per module (pages + feature components)
docs/            research and plan → roast → plan v2
```

Conventions: domain code has no React; pages read narrow store selectors and call actions;
cross-module side effects (charges, audit trail, sync jobs, notifications) live in
`src/store/helpers.ts`.

## Limits (honest)

Demo only: no authentication, no server authorisation, no real BPJS/SATUSEHAT calls (jobs are
simulated), the grouper is an estimate, and clinical rules are simplified references — not a
certified medical device.
