import { Card, Chip, Switch } from "@heroui/react"
import { Check, Link2, Sparkles } from "lucide-react"
import type { ReactNode } from "react"
import { CATEGORY_COLOR, MODULE_ICON } from "@/app/navigation"
import { CATEGORY_LABEL, moduleText, type ModuleDef, type ModuleId } from "@/domain/modules"
import type { Region } from "@/domain/region"
import { cn } from "@/lib/cn"

interface ModuleCardProps {
  module: ModuleDef
  /** Market whose wording to show (onboarding passes the region being chosen). */
  region: Region
  enabled: boolean
  onToggle?: (next: boolean) => void
  /** Modules currently enabled — used to show which "enhances" benefits are live. */
  enabledSet: Set<ModuleId>
  highlight?: boolean
  footer?: ReactNode
  badge?: ReactNode
}

/** One module: what it does, what it needs, what it unlocks. Used in onboarding and the Module Center. */
export function ModuleCard({ module: base, region, enabled, onToggle, enabledSet, highlight, footer, badge }: ModuleCardProps) {
  const module = moduleText(base.id, region)
  const Icon = MODULE_ICON[module.id]
  return (
    <div id={`module-${module.id}`} className="relative h-full pt-[22px]">
      {/* Divider tab, coloured by category — the same colours as the sidebar binder. */}
      <span className={cn("label-caps absolute left-4 top-0 flex h-[23px] items-center rounded-t-lg px-2.5 text-[oklch(0.2_0.02_262)]", CATEGORY_COLOR[module.category])}>
        {CATEGORY_LABEL[module.category]}
      </span>
      <Card className={cn("h-full gap-3 rounded-tl-none p-4 transition", enabled ? "border-foreground/25" : "bg-surface/60", highlight && "ring-2 ring-accent")}>
        <div className="flex items-start gap-3">
          <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl border", enabled ? "border-transparent bg-foreground text-background" : "border-dashed border-border text-muted")}>
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[17px] font-semibold">{module.name}</h3>
              {module.core && <span className="label-caps rounded border border-border px-1.5 py-0.5 text-muted">Core</span>}
              {badge}
            </div>
            <p className="mt-0.5 text-sm text-muted">{module.summary}</p>
          </div>
          {onToggle && !module.core && (
            <Switch isSelected={enabled} onChange={onToggle} aria-label={`${enabled ? "Turn off" : "Turn on"} ${module.name}`}>
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          )}
        </div>

        <ul className="space-y-1 text-sm">
          {module.features.map((f) => (
            <li key={f} className="flex gap-2 text-foreground/80">
              <Check className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
              {f}
            </li>
          ))}
        </ul>

        {(module.requires.length > 0 || module.enhances.length > 0) && (
          <div className="mt-auto space-y-1.5 border-t border-dashed border-border pt-3 text-xs">
            {module.requires.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Link2 className="size-3.5 text-muted" aria-hidden />
                <span className="label-caps text-muted">Requires</span>
                {module.requires.map((r) => (
                  <Chip key={r} size="sm" variant="soft" color={enabledSet.has(r) ? "success" : "warning"}>
                    {moduleText(r, region).name}
                  </Chip>
                ))}
              </div>
            )}
            {module.enhances.map((e) => (
              <div key={e.module} className="flex gap-1.5 text-muted">
                <Sparkles className={cn("mt-0.5 size-3.5 shrink-0", enabledSet.has(e.module) ? "text-accent" : "text-muted")} aria-hidden />
                <span>
                  <b className={enabledSet.has(e.module) ? "text-foreground" : undefined}>+ {moduleText(e.module, region).name}:</b> {e.benefit}
                </span>
              </div>
            ))}
          </div>
        )}
        {footer}
      </Card>
    </div>
  )
}
