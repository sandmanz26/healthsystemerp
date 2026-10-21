/**
 * Module Center — where a facility grows. Enabling shows exactly what else comes along;
 * disabling explains what depends on it and promises data is kept.
 */
import { Button, Checkbox, Chip, Label, ProgressBar } from "@heroui/react"
import { ArrowUpRight, Lightbulb, Puzzle } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Dialog } from "@/components/ui/dialog"
import { Page, PageHeader } from "@/components/ui/page"
import { Segmented } from "@/components/ui/segmented"
import { CATEGORY_LABEL, CATEGORY_ORDER, FACILITY_PRESETS, MODULES, MODULE_MAP, blockersForDisable, missingForEnable, type ModuleId } from "@/domain/modules"
import { toast } from "@/lib/toast"
import { useActions, useStore } from "@/store"
import { inFlightWork, useEnabledModules } from "@/store/selectors"
import { ModuleCard } from "./module-card"

type Filter = "all" | "on" | "off"
type Pending = { kind: "enable"; id: ModuleId; extra: ModuleId[] } | { kind: "disable"; id: ModuleId; blockers: ModuleId[]; work: string[] }

export default function ModuleCenterPage() {
  const modules = useStore((s) => s.modules)
  const facilityType = useStore((s) => s.facility.type)
  const enabled = useEnabledModules()
  const { enableModule, disableModule, toggleSetupItem } = useActions()
  const [filter, setFilter] = useState<Filter>("all")
  const [pending, setPending] = useState<Pending>()
  const [params] = useSearchParams()
  const focus = params.get("focus") as ModuleId | null
  const preset = FACILITY_PRESETS.find((p) => p.id === facilityType)!
  const suggestions = preset.next.filter((m) => !enabled.has(m))

  useEffect(() => {
    if (focus) document.getElementById(`module-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [focus])

  const toggleable = MODULES.filter((m) => !m.core)
  const onCount = toggleable.filter((m) => enabled.has(m.id)).length
  const visible = useMemo(() => MODULES.filter((m) => (filter === "all" ? true : filter === "on" ? enabled.has(m.id) : !enabled.has(m.id))), [filter, enabled])

  const request = (id: ModuleId, on: boolean) => {
    if (on) setPending({ kind: "enable", id, extra: missingForEnable(id, enabled) })
    else setPending({ kind: "disable", id, blockers: blockersForDisable(id, enabled), work: inFlightWork(useStore.getState(), id) })
  }

  const confirm = () => {
    if (!pending) return
    const name = MODULE_MAP[pending.id].name
    if (pending.kind === "enable") {
      enableModule(pending.id)
      toast.success(`${name} aktif`, { description: pending.extra.length ? `Juga mengaktifkan ${pending.extra.map((m) => MODULE_MAP[m].name).join(", ")}.` : "Menu baru sudah muncul di sidebar." })
    } else if (pending.blockers.length === 0) {
      disableModule(pending.id)
      toast(`${name} dinonaktifkan`, { description: "Data tetap tersimpan dan kembali saat modul diaktifkan lagi." })
    }
    setPending(undefined)
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Pusat Modul"
        title="Bangun sistem sesuai kebutuhan"
        description="Aktifkan modul ketika tim siap. Modul yang nonaktif tidak tampil untuk siapa pun dan datanya tetap aman."
        actions={
          <div className="w-56">
            <ProgressBar value={onCount} maxValue={toggleable.length} aria-label="Modul aktif">
              <div className="mb-1 flex justify-between text-xs">
                <Label className="text-xs">Modul aktif</Label>
                <span className="tabular font-semibold">
                  {onCount}/{toggleable.length}
                </span>
              </div>
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
          </div>
        }
      />

      {suggestions.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-accent/30 bg-accent-soft/50 p-4 sm:flex-row sm:items-center">
          <Lightbulb className="size-5 shrink-0 text-accent" aria-hidden />
          <div className="flex-1 text-sm">
            <b>Tahap berikutnya untuk {preset.name}:</b> setelah modul awal berjalan lancar, faskes sejenis biasanya menambah{" "}
            {suggestions.map((m, i) => (
              <span key={m}>
                {i > 0 && ", "}
                <button type="button" className="font-semibold text-accent underline-offset-2 hover:underline" onClick={() => request(m, true)}>
                  {MODULE_MAP[m].name}
                </button>
              </span>
            ))}
            .
          </div>
        </div>
      )}

      <div className="mb-4">
        <Segmented
          label="Filter modul"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Semua", count: MODULES.length },
            { value: "on", label: "Aktif", count: enabled.size },
            { value: "off", label: "Belum aktif", count: MODULES.length - enabled.size },
          ]}
        />
      </div>

      <div className="space-y-8">
        {CATEGORY_ORDER.map((category) => {
          const items = visible.filter((m) => m.category === category)
          if (!items.length) return null
          return (
            <section key={category} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{CATEGORY_LABEL[category]}</h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {items.map((m) => {
                  const state = modules[m.id]
                  const on = enabled.has(m.id)
                  const done = m.setup.filter((s) => state.setupDone.includes(s.id)).length
                  return (
                    <ModuleCard
                      key={m.id}
                      module={m}
                      enabled={on}
                      enabledSet={enabled}
                      highlight={focus === m.id}
                      onToggle={(next) => request(m.id, next)}
                      badge={
                        on && m.setup.length > 0 ? (
                          <Chip size="sm" variant="soft" color={done === m.setup.length ? "success" : "warning"}>
                            Persiapan {done}/{m.setup.length}
                          </Chip>
                        ) : undefined
                      }
                      footer={
                        on && m.setup.length > 0 ? (
                          <div className="space-y-1.5 rounded-xl bg-surface-secondary p-3">
                            <div className="text-xs font-semibold text-muted">Checklist persiapan</div>
                            {m.setup.map((s) => (
                              <Checkbox key={s.id} isSelected={state.setupDone.includes(s.id)} onChange={() => toggleSetupItem(m.id, s.id)}>
                                <Checkbox.Content>
                                  <Checkbox.Control>
                                    <Checkbox.Indicator />
                                  </Checkbox.Control>
                                  <Label className="text-sm">{s.label}</Label>
                                </Checkbox.Content>
                              </Checkbox>
                            ))}
                          </div>
                        ) : undefined
                      }
                    />
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      {pending && (
        <Dialog
          isOpen
          onOpenChange={(o) => !o && setPending(undefined)}
          title={pending.kind === "enable" ? `Aktifkan ${MODULE_MAP[pending.id].name}?` : pending.blockers.length ? `${MODULE_MAP[pending.id].name} masih dibutuhkan` : `Nonaktifkan ${MODULE_MAP[pending.id].name}?`}
          footer={
            <>
              <Button variant="tertiary" onPress={() => setPending(undefined)}>
                {pending.kind === "disable" && pending.blockers.length ? "Mengerti" : "Batal"}
              </Button>
              {!(pending.kind === "disable" && pending.blockers.length) && (
                <Button variant={pending.kind === "enable" ? "primary" : "danger"} onPress={confirm}>
                  {pending.kind === "enable" ? "Aktifkan" : "Nonaktifkan"}
                </Button>
              )}
            </>
          }
        >
          {pending.kind === "enable" ? (
            <div className="space-y-3 text-sm">
              <p>{MODULE_MAP[pending.id].summary}</p>
              {pending.extra.length > 0 && (
                <div className="rounded-xl bg-warning-soft p-3 text-warning-soft-foreground">
                  <b>Ikut diaktifkan</b> karena dibutuhkan:
                  <ul className="mt-1 list-inside list-disc">
                    {pending.extra.map((m) => (
                      <li key={m}>{MODULE_MAP[m].name}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="flex items-center gap-1.5 text-muted">
                <Puzzle className="size-4" aria-hidden />
                Menu akan muncul untuk peran: {MODULE_MAP[pending.id].roles.length > 6 ? "semua staf" : MODULE_MAP[pending.id].roles.join(", ")}.
              </p>
            </div>
          ) : pending.blockers.length ? (
            <div className="space-y-2 text-sm">
              <p>Modul berikut membutuhkan {MODULE_MAP[pending.id].name}. Nonaktifkan dulu modul-modul ini:</p>
              <ul className="space-y-1">
                {pending.blockers.map((m) => (
                  <li key={m}>
                    <a href={`#/modules?focus=${m}`} onClick={() => setPending(undefined)} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                      {MODULE_MAP[m].name}
                      <ArrowUpRight className="size-3.5" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p>
                Menu {MODULE_MAP[pending.id].name} akan hilang untuk semua pengguna. <b>Data tidak dihapus</b> — semuanya kembali saat modul diaktifkan lagi.
              </p>
              {pending.work.length > 0 && (
                <div className="rounded-xl bg-warning-soft p-3 text-warning-soft-foreground">
                  <b>Masih ada pekerjaan berjalan:</b>
                  <ul className="mt-1 list-inside list-disc">
                    {pending.work.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                  <p className="mt-1">Selesaikan atau alihkan dulu — setelah dinonaktifkan, staf tidak bisa membukanya.</p>
                </div>
              )}
            </div>
          )}
        </Dialog>
      )}
    </Page>
  )
}
