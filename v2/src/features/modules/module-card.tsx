import { Card, Chip, Switch } from "@heroui/react"
import { Check, Link2, Sparkles } from "lucide-react"
import type { ReactNode } from "react"
import { MODULE_ICON } from "@v2/app/navigation"
import { moduleText, type ModuleDef, type ModuleId } from "@v2/domain/modules"
import type { Region } from "@v2/domain/region"
import { cn } from "@v2/lib/cn"

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
    <div id={`module-${module.id}`} className="relative h-full">
      <Card className={cn("h-full gap-3 p-4 transition", !enabled && "bg-surface-secondary", highlight && "ring-2 ring-accent")}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Icon className={cn("size-4 shrink-0", enabled ? "text-foreground" : "text-muted")} aria-hidden />
              <h3 className="text-base font-semibold">{module.name}</h3>
              {module.core && <span className="rounded border border-border px-1.5 py-0.5 text-xs text-muted">Core</span>}
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
