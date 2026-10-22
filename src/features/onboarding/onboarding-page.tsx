/**
 * First run: choose the facility type, review a deliberately small starting set of modules,
 * done. Everything can be changed later in the Module Center — the wizard says so, so
 * nobody feels they must get it perfect on day one.
 */
import { Button, Card, Chip } from "@heroui/react"
import { ArrowLeft, ArrowRight, Building2, Hospital, Stethoscope } from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Logo } from "@/app/logo"
import { CATEGORY_COLOR } from "@/app/navigation"
import { TextInput } from "@/components/ui/fields"
import { CATEGORY_LABEL, CATEGORY_ORDER, FACILITY_PRESETS, MODULES, MODULE_MAP, withDependencies, withoutDependents, type FacilityType, type ModuleId } from "@/domain/modules"
import { cn } from "@/lib/cn"
import { useActions, useStore } from "@/store"
import { ModuleCard } from "../modules/module-card"

const PRESET_ICON: Record<FacilityType, typeof Hospital> = {
  "klinik-pratama": Stethoscope,
  "klinik-utama": Stethoscope,
  "rs-dasar": Building2,
  "rs-madya": Hospital,
  "rs-rujukan": Hospital,
}

export default function OnboardingPage() {
  const facility = useStore((s) => s.facility)
  const { completeOnboarding } = useActions()
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState(facility.name)
  const [type, setType] = useState<FacilityType>("rs-madya")
  const preset = FACILITY_PRESETS.find((p) => p.id === type)!
  const [selected, setSelected] = useState<Set<ModuleId>>(() => withDependencies(preset.start))
  const [note, setNote] = useState<string>()

  const chooseType = (t: FacilityType) => {
    setType(t)
    setSelected(withDependencies(FACILITY_PRESETS.find((p) => p.id === t)!.start))
  }

  const toggle = (id: ModuleId, on: boolean) => {
    if (on) {
      const next = withDependencies([...selected, id])
      const added = [...next].filter((m) => m !== id && !selected.has(m))
      setNote(added.length ? `${MODULE_MAP[id].name} membutuhkan ${added.map((m) => MODULE_MAP[m].name).join(", ")} — ikut diaktifkan.` : undefined)
      setSelected(next)
    } else {
      const next = withoutDependents(id, selected)
      const removed = [...selected].filter((m) => m !== id && !next.has(m))
      setNote(removed.length ? `${removed.map((m) => MODULE_MAP[m].name).join(", ")} ikut dinonaktifkan karena membutuhkan ${MODULE_MAP[id].name}.` : undefined)
      setSelected(next)
    }
  }

  const finish = (modules: ModuleId[]) => {
    completeOnboarding({ facilityName: name, type, modules })
    navigate("/", { replace: true })
  }

  const grouped = useMemo(() => CATEGORY_ORDER.filter((c) => c !== "core").map((c) => ({ category: c, modules: MODULES.filter((m) => m.category === c) })), [])

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <Logo />
          <span className="text-sm text-muted">Langkah {step} dari 2</span>
        </div>

        {step === 1 && (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
            <div className="bg-grid rounded-[20px] border border-border bg-surface p-8 lg:sticky lg:top-8">
              <span className="label-caps text-muted">Langkah 1 · Faskes Anda</span>
              <h1 className="mt-3 text-[40px] font-semibold leading-[1.05] sm:text-5xl">Mulai dari yang Anda butuhkan hari ini.</h1>
              <p className="mt-4 max-w-md text-muted">
                Setiap modul adalah satu slot. Pasang yang dibutuhkan tim sekarang; tambahkan sisanya ketika siap. Modul yang belum dipasang tidak akan muncul di layar siapa pun.
              </p>
              <div className="mt-8">
                <div className="flex items-baseline justify-between">
                  <span className="label-caps text-muted">Slot terpasang · {preset.name}</span>
                  <span className="num text-sm font-semibold">
                    {withDependencies(preset.start).size}/{MODULES.filter((m) => !m.core).length}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-[repeat(19,minmax(0,1fr))] gap-1" aria-hidden>
                  {MODULES.filter((m) => !m.core).map((m) => (
                    <span key={m.id} className={cn("h-10 rounded-[3px] transition-colors duration-300", withDependencies(preset.start).has(m.id) ? CATEGORY_COLOR[m.category] : "bg-surface-tertiary")} title={m.name} />
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
              <TextInput label="Nama faskes" value={name} onChange={setName} isRequired />
              <fieldset>
                <legend className="label-caps mb-3 text-muted">Jenis faskes</legend>
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
                          <span className="block font-display text-[17px] font-semibold">{p.name}</span>
                          <span className="block text-sm text-muted">{p.description}</span>
                        </span>
                        <span className="num shrink-0 text-right text-xs text-muted">
                          <b className="block text-lg text-foreground">{p.start.length}</b>
                          modul awal
                        </span>
                      </button>
                    )
                  })}
                </div>
              </fieldset>
              <div className="flex justify-end">
                <Button variant="primary" size="lg" onPress={() => setStep(2)} isDisabled={!name.trim()}>
                  Lanjut pilih modul
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-4xl font-semibold">Modul awal untuk {preset.name}</h1>
                <p className="mt-2 max-w-2xl text-muted">
                  Yang tercentang adalah saran kami untuk mulai. Modul inti (Master Pasien, Pengaturan) selalu aktif. Modul yang tidak aktif <b>tidak akan tampil</b> di menu siapa pun.
                </p>
              </div>
              <Card className="shrink-0 flex-row items-center gap-4 px-5 py-3">
                <div>
                  <div className="tabular text-2xl font-bold">{selected.size}</div>
                  <div className="text-xs text-muted">modul dipilih</div>
                </div>
                <Button variant="primary" onPress={() => finish([...selected])}>
                  Mulai gunakan
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
                      enabled={selected.has(m.id)}
                      enabledSet={selected}
                      onToggle={(on) => toggle(m.id, on)}
                      badge={
                        preset.start.includes(m.id) ? (
                          <Chip size="sm" color="accent" variant="soft">
                            Disarankan
                          </Chip>
                        ) : preset.next.includes(m.id) ? (
                          <Chip size="sm" variant="soft">
                            Tahap berikutnya
                          </Chip>
                        ) : undefined
                      }
                    />
                  ))}
                </div>
              </section>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-separator pt-6">
              <Button variant="ghost" onPress={() => setStep(1)}>
                <ArrowLeft className="size-4" aria-hidden />
                Kembali
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button variant="tertiary" onPress={() => finish(MODULES.filter((m) => !m.core).map((m) => m.id))}>
                  Aktifkan semua (demo lengkap)
                </Button>
                <Button variant="primary" onPress={() => finish([...selected])}>
                  Mulai dengan {selected.size} modul
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
