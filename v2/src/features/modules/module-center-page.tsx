/**
 * Module Center — where a facility grows. Enabling shows exactly what else comes along;
 * disabling explains what depends on it and promises data is kept.
 */
import { Button, Checkbox, Chip, Label, ProgressBar } from "@heroui/react"
import { ArrowUpRight, Lightbulb, Puzzle } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Dialog } from "@v2/components/ui/dialog"
import { Page, PageHeader } from "@v2/components/ui/page"
import { Segmented } from "@v2/components/ui/segmented"
import { CATEGORY_LABEL, CATEGORY_ORDER, FACILITY_PRESETS, MODULES, blockersForDisable, missingForEnable, moduleText, type ModuleId } from "@v2/domain/modules"
import { REGIONS } from "@v2/domain/region"
import { ROLES } from "@v2/domain/roles"
import { toast } from "@v2/lib/toast"
import { useActions, useStore } from "@v2/store"
import { inFlightWork, useEnabledModules, useRegion } from "@v2/store/selectors"
import { ModuleCard } from "./module-card"

type Filter = "all" | "on" | "off"
type Pending = { kind: "enable"; id: ModuleId; extra: ModuleId[] } | { kind: "disable"; id: ModuleId; blockers: ModuleId[]; work: string[] }

export default function ModuleCenterPage() {
  const modules = useStore((s) => s.modules)
  const facilityType = useStore((s) => s.facility.type)
  const enabled = useEnabledModules()
  const region = useRegion()
  const name = (id: ModuleId) => moduleText(id, region).name
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
    const label = name(pending.id)
    if (pending.kind === "enable") {
      enableModule(pending.id)
      toast.success(`${label} turned on`, { description: pending.extra.length ? `Also turned on: ${pending.extra.map(name).join(", ")}.` : "The new menu item is now in the sidebar." })
    } else if (pending.blockers.length === 0) {
      disableModule(pending.id)
      toast(`${label} turned off`, { description: "Its data is kept and comes back when the module is turned on again." })
    }
    setPending(undefined)
  }

  return (
    <Page>
      <PageHeader
        eyebrow={region === "uk" ? "Module Centre" : "Module Center"}
        title="Build the system you need"
        description={`Turn modules on when your team is ready. Modules that are off are hidden from everyone, and their data is kept. Market pack: ${REGIONS[region].name}.`}
        actions={
          <div className="w-56">
            <ProgressBar value={onCount} maxValue={toggleable.length} aria-label="Modules on">
              <div className="mb-1 flex justify-between text-xs">
                <Label className="text-xs">Modules on</Label>
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
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-accent/30 bg-accent-soft/50 p-4 sm:flex-row sm:items-center">
          <Lightbulb className="size-5 shrink-0 text-accent" aria-hidden />
          <div className="flex-1 text-sm">
            <b>Next step for your {preset.name[region].toLowerCase()}:</b> once the starting modules run smoothly, similar facilities usually add{" "}
            {suggestions.map((m, i) => (
              <span key={m}>
                {i > 0 && ", "}
                <button type="button" className="font-semibold text-accent underline-offset-2 hover:underline" onClick={() => request(m, true)}>
                  {name(m)}
                </button>
              </span>
            ))}
            .
          </div>
        </div>
      )}

      <div className="mb-4">
        <Segmented
          label="Filter modules"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: MODULES.length },
            { value: "on", label: "On", count: enabled.size },
            { value: "off", label: "Off", count: MODULES.length - enabled.size },
          ]}
        />
      </div>

      <div className="space-y-8">
        {CATEGORY_ORDER.map((category) => {
          const items = visible.filter((m) => m.category === category)
          if (!items.length) return null
          return (
            <section key={category} className="space-y-3">
              <h2 className="text-sm font-medium text-muted">{CATEGORY_LABEL[category]}</h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {items.map((m) => {
                  const state = modules[m.id]
                  const on = enabled.has(m.id)
                  const setup = moduleText(m.id, region).setup
                  const done = setup.filter((s) => state.setupDone.includes(s.id)).length
                  return (
                    <ModuleCard
                      key={m.id}
                      module={m}
                      region={region}
                      enabled={on}
                      enabledSet={enabled}
                      highlight={focus === m.id}
                      onToggle={(next) => request(m.id, next)}
                      badge={
                        on && setup.length > 0 ? (
                          <Chip size="sm" variant="soft" color={done === setup.length ? "success" : "warning"}>
                            Setup {done}/{setup.length}
                          </Chip>
                        ) : undefined
                      }
                      footer={
                        on && setup.length > 0 ? (
                          <div className="space-y-1.5 rounded-lg bg-surface-secondary p-3">
                            <div className="text-xs font-semibold text-muted">Go-live checklist</div>
                            {setup.map((s) => (
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
          title={pending.kind === "enable" ? `Turn on ${name(pending.id)}?` : pending.blockers.length ? `${name(pending.id)} is still required` : `Turn off ${name(pending.id)}?`}
          footer={
            <>
              <Button variant="tertiary" onPress={() => setPending(undefined)}>
                {pending.kind === "disable" && pending.blockers.length ? "Got it" : "Cancel"}
              </Button>
              {!(pending.kind === "disable" && pending.blockers.length) && (
                <Button variant={pending.kind === "enable" ? "primary" : "danger"} onPress={confirm}>
                  {pending.kind === "enable" ? "Turn on" : "Turn off"}
                </Button>
              )}
            </>
          }
        >
          {pending.kind === "enable" ? (
            <div className="space-y-3 text-sm">
              <p>{moduleText(pending.id, region).summary}</p>
              {pending.extra.length > 0 && (
                <div className="rounded-lg bg-warning-soft p-3 text-warning-soft-foreground">
                  <b>Also turned on</b> because it is required:
                  <ul className="mt-1 list-inside list-disc">
                    {pending.extra.map((m) => (
                      <li key={m}>{name(m)}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="flex items-center gap-1.5 text-muted">
                <Puzzle className="size-4" aria-hidden />
                Visible to: {moduleText(pending.id, region).roles.length > 6 ? "all staff" : moduleText(pending.id, region).roles.map((r) => ROLES[r].label).join(", ")}.
              </p>
            </div>
          ) : pending.blockers.length ? (
            <div className="space-y-2 text-sm">
              <p>These modules require {name(pending.id)}. Turn them off first:</p>
              <ul className="space-y-1">
                {pending.blockers.map((m) => (
                  <li key={m}>
                    <a href={`#/modules?focus=${m}`} onClick={() => setPending(undefined)} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                      {name(m)}
                      <ArrowUpRight className="size-3.5" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p>
                {name(pending.id)} will disappear for every user. <b>No data is deleted</b> — everything comes back when the module is turned on again.
              </p>
              {pending.work.length > 0 && (
                <div className="rounded-lg bg-warning-soft p-3 text-warning-soft-foreground">
                  <b>Work still in progress:</b>
                  <ul className="mt-1 list-inside list-disc">
                    {pending.work.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                  <p className="mt-1">Finish or hand it over first — once the module is off, staff cannot open this work.</p>
                </div>
              )}
            </div>
          )}
        </Dialog>
      )}
    </Page>
  )
}
