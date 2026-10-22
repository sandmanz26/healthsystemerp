/**
 * First run: choose the market (US or UK/Europe), then the facility type, then review a
 * deliberately small starting set of modules. Everything except the market can be changed
 * later in the Module Center — the wizard says so, so nobody feels they must get it perfect
 * on day one. Switching market later (Settings → Facility) rebuilds the demo data.
 */
import { Button, Card, Chip } from "@heroui/react"
import { Ambulance, ArrowLeft, ArrowRight, Building2, Check, GraduationCap, Hospital, Stethoscope } from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Logo } from "@/app/logo"
import { CATEGORY_COLOR } from "@/app/navigation"
import { TextInput } from "@/components/ui/fields"
import { CATEGORY_LABEL, CATEGORY_ORDER, FACILITY_PRESETS, MODULES, moduleText, withDependencies, withoutDependents, type FacilityType, type ModuleId } from "@/domain/modules"
import { REGIONS, type Region } from "@/domain/region"
import { cn } from "@/lib/cn"
import { useActions, useStore } from "@/store"
import { ModuleCard } from "../modules/module-card"

const PRESET_ICON: Record<FacilityType, typeof Hospital> = {
  clinic: Stethoscope,
  "urgent-care": Ambulance,
  community: Building2,
  general: Hospital,
  academic: GraduationCap,
}

/** What actually changes between the two market packs — concrete, so the choice is informed. */
const MARKET_DIFFS: { topic: string; us: string; uk: string }[] = [
  { topic: "Diagnosis & procedure codes", us: "ICD-10-CM · CPT / HCPCS", uk: "ICD-10 (WHO) · OPCS-4.10 · SNOMED CT" },
  { topic: "Case-mix & payment", us: "MS-DRG · UB-04 revenue codes · X12 837/835", uk: "HRG4+ · NHS Payment Scheme · SUS+" },
  { topic: "ED triage & targets", us: "ESI v5 · door-to-provider · CMS SEP-1", uk: "Manchester Triage · 4-hour standard · Sepsis Six" },
  { topic: "National services", us: "X12 270/271 eligibility · Surescripts e-Rx", uk: "NHS Spine: PDS, EPS, e-RS, GP Connect" },
  { topic: "Privacy law", us: "HIPAA Privacy & Security Rules", uk: "UK GDPR / DPA 2018 · DSP Toolkit" },
  { topic: "Units & currency", us: "°F · mg/dL · lb · $ · 12-hour clock", uk: "°C · mmol/L · kg · £ · 24-hour clock" },
  { topic: "Patient identifiers", us: "MRN · payer member ID · MBI", uk: "MRN · NHS number (Modulus 11)" },
]

const MARKET_ORDER: Region[] = ["us", "uk"]
const DEMO_NAMES: Record<Region, string> = { us: "Medisphere General Hospital", uk: "Northgate General Hospital" }
const STEP_COUNT = 3

export default function OnboardingPage() {
  const facility = useStore((s) => s.facility)
  const { completeOnboarding } = useActions()
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [region, setRegion] = useState<Region>(facility.region)
  const [name, setName] = useState(facility.name)
  const [type, setType] = useState<FacilityType>("general")
  const preset = FACILITY_PRESETS.find((p) => p.id === type)!
  const [selected, setSelected] = useState<Set<ModuleId>>(() => withDependencies(preset.start))
  const [note, setNote] = useState<string>()

  const chooseType = (t: FacilityType) => {
    setType(t)
    setSelected(withDependencies(FACILITY_PRESETS.find((p) => p.id === t)!.start))
  }

  const label = (id: ModuleId) => moduleText(id, region).name

  const chooseRegion = (r: Region) => {
    setRegion(r)
    // Suggest the market's demo facility name unless the user has typed their own.
    if (!name.trim() || Object.values(DEMO_NAMES).includes(name)) setName(DEMO_NAMES[r])
  }

  const toggle = (id: ModuleId, on: boolean) => {
    if (on) {
      const next = withDependencies([...selected, id])
      const added = [...next].filter((m) => m !== id && !selected.has(m))
      setNote(added.length ? `${label(id)} requires ${added.map(label).join(", ")} — turned on as well.` : undefined)
      setSelected(next)
    } else {
      const next = withoutDependents(id, selected)
      const removed = [...selected].filter((m) => m !== id && !next.has(m))
      setNote(removed.length ? `${removed.map(label).join(", ")} turned off as well, because they require ${label(id)}.` : undefined)
      setSelected(next)
    }
  }

  const finish = (modules: ModuleId[]) => {
    completeOnboarding({ facilityName: name, type, modules, region })
    navigate("/", { replace: true })
  }

  const grouped = useMemo(() => CATEGORY_ORDER.filter((c) => c !== "core").map((c) => ({ category: c, modules: MODULES.filter((m) => m.category === c) })), [])

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <Logo />
          <span className="text-sm text-muted">
            Step {step} of {STEP_COUNT}
          </span>
        </div>

        {step === 1 && (
          <div className="space-y-8">
            <div className="max-w-3xl">
              <span className="label-caps text-muted">Step 1 · Market</span>
              <h1 className="mt-3 text-[40px] font-semibold leading-[1.05] sm:text-5xl">Where does your organization deliver care?</h1>
              <p className="mt-4 text-muted">
                The market pack sets the code systems, triage scale, payer model, national interfaces, privacy rules and units used on every screen. It is the one choice you
                should not change casually — switching later rebuilds the demo data.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2" role="radiogroup" aria-label="Market">
              {MARKET_ORDER.map((r) => {
                const info = REGIONS[r]
                const active = r === region
                return (
                  <button
                    type="button"
                    key={r}
                    role="radio"
                    aria-checked={active}
                    onClick={() => chooseRegion(r)}
                    className={cn("flex flex-col gap-4 rounded-[18px] border bg-surface p-5 text-left transition", active ? "border-foreground shadow-[inset_4px_0_0_var(--accent)]" : "border-border hover:border-foreground/40")}
                  >
                    <div className="flex items-start gap-3">
                      <span className={cn("num grid h-11 min-w-11 shrink-0 place-items-center rounded-xl px-2 text-sm font-bold", active ? "bg-foreground text-background" : "border border-dashed border-border text-muted")}>{info.short}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-xl font-semibold">{info.name}</span>
                        <span className="block text-sm text-muted">
                          {r === "us"
                            ? "Hospitals and physician practices billing Medicare, Medicaid and commercial plans."
                            : "NHS trusts and independent hospitals; the same pack serves continental European sites (WHO ICD-10, SI units, GDPR)."}
                        </span>
                      </span>
                      {active && <Check className="size-5 shrink-0 text-accent" aria-hidden />}
                    </div>
                    <dl className="grid gap-x-4 gap-y-2 border-t border-dashed border-border pt-3 text-sm sm:grid-cols-[minmax(0,11rem)_1fr]">
                      {MARKET_DIFFS.map((d) => (
                        <div key={d.topic} className="contents">
                          <dt className="label-caps pt-0.5 text-muted">{d.topic}</dt>
                          <dd className="num text-[13px] text-foreground/85">{d[r]}</dd>
                        </div>
                      ))}
                    </dl>
                    <span className="num text-[11px] text-muted">
                      FHIR R4 · {info.fhirProfile} · HL7 v2.5.1 · {info.locale}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="flex justify-end">
              <Button variant="primary" size="lg" onPress={() => setStep(2)}>
                Continue with {REGIONS[region].short}
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
            <div className="bg-grid rounded-[20px] border border-border bg-surface p-8 lg:sticky lg:top-8">
              <span className="label-caps text-muted">Step 2 · Your facility</span>
              <h1 className="mt-3 text-[40px] font-semibold leading-[1.05] sm:text-5xl">Start with what you need today.</h1>
              <p className="mt-4 max-w-md text-muted">
                Each module is one slot. Install what your team needs now and add the rest when you are ready. Modules that are not installed never appear on anyone’s screen.
              </p>
              <div className="mt-8">
                <div className="flex items-baseline justify-between">
                  <span className="label-caps text-muted">Slots installed · {preset.name[region]}</span>
                  <span className="num text-sm font-semibold">
                    {withDependencies(preset.start).size}/{MODULES.filter((m) => !m.core).length}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-[repeat(19,minmax(0,1fr))] gap-1" aria-hidden>
                  {MODULES.filter((m) => !m.core).map((m) => (
                    <span key={m.id} className={cn("h-10 rounded-[3px] transition-colors duration-300", withDependencies(preset.start).has(m.id) ? CATEGORY_COLOR[m.category] : "bg-surface-tertiary")} title={label(m.id)} />
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                  {CATEGORY_ORDER.filter((c) => c !== "core").map((c) => (
                    <span key={c} className="flex items-center gap-1.5 text-[11px] text-muted">
                      <span className={cn("size-2 rounded-sm", CATEGORY_COLOR[c])} />
                      {CATEGORY_LABEL[c]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <TextInput label={region === "us" ? "Facility name" : "Hospital or trust site name"} value={name} onChange={setName} isRequired />
              <fieldset>
                <legend className="label-caps mb-3 text-muted">Facility type</legend>
                <div className="grid gap-3">
                  {FACILITY_PRESETS.map((p) => {
                    const Icon = PRESET_ICON[p.id]
                    const active = p.id === type
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => chooseType(p.id)}
                        aria-pressed={active}
                        className={cn("flex items-center gap-4 rounded-[14px] border bg-surface p-4 text-left transition", active ? "border-foreground shadow-[inset_4px_0_0_var(--accent)]" : "border-border hover:border-foreground/40")}
                      >
                        <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", active ? "bg-foreground text-background" : "border border-dashed border-border text-muted")}>
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-display text-[17px] font-semibold">{p.name[region]}</span>
                          <span className="block text-sm text-muted">{p.description}</span>
                        </span>
                        <span className="num shrink-0 text-right text-xs text-muted">
                          <b className="block text-lg text-foreground">{p.start.length}</b>
                          starting modules
                        </span>
                      </button>
                    )
                  })}
                </div>
              </fieldset>
              <div className="flex justify-between">
                <Button variant="ghost" size="lg" onPress={() => setStep(1)}>
                  <ArrowLeft className="size-4" aria-hidden />
                  Back
                </Button>
                <Button variant="primary" size="lg" onPress={() => setStep(3)} isDisabled={!name.trim()}>
                  Continue to modules
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-4xl font-semibold">Starting modules · {preset.name[region]}</h1>
                <p className="mt-2 max-w-2xl text-muted">
                  The modules switched on are our recommended starting set for {REGIONS[region].name}. Core modules (Patient Index, Settings & Access) are always on. Modules that are off <b>never appear</b> in anyone’s menu.
                </p>
              </div>
              <Card className="shrink-0 flex-row items-center gap-4 px-5 py-3">
                <div>
                  <div className="tabular text-2xl font-bold">{selected.size}</div>
                  <div className="text-xs text-muted">modules selected</div>
                </div>
                <Button variant="primary" onPress={() => finish([...selected])}>
                  Get started
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              </Card>
            </div>
            {note && (
              <div role="status" className="rounded-xl bg-accent-soft px-4 py-2.5 text-sm text-accent-soft-foreground">
                {note}
              </div>
            )}
            {grouped.map(({ category, modules }) => (
              <section key={category} className="space-y-3">
                <h2 className="label-caps text-muted">{CATEGORY_LABEL[category]}</h2>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {modules.map((m) => (
                    <ModuleCard
                      key={m.id}
                      module={m}
                      region={region}
                      enabled={selected.has(m.id)}
                      enabledSet={selected}
                      onToggle={(on) => toggle(m.id, on)}
                      badge={
                        preset.start.includes(m.id) ? (
                          <Chip size="sm" color="accent" variant="soft">
                            Recommended
                          </Chip>
                        ) : preset.next.includes(m.id) ? (
                          <Chip size="sm" variant="soft">
                            Next phase
                          </Chip>
                        ) : undefined
                      }
                    />
                  ))}
                </div>
              </section>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-separator pt-6">
              <Button variant="ghost" onPress={() => setStep(2)}>
                <ArrowLeft className="size-4" aria-hidden />
                Back
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button variant="tertiary" onPress={() => finish(MODULES.filter((m) => !m.core).map((m) => m.id))}>
                  Turn everything on (full demo)
                </Button>
                <Button variant="primary" onPress={() => finish([...selected])}>
                  Start with {selected.size} modules
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
