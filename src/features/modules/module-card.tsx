import { Card, Chip, Switch } from "@heroui/react"
import { Check, Link2, Sparkles } from "lucide-react"
import type { ReactNode } from "react"
import { MODULE_ICON } from "@/app/navigation"
import { MODULE_MAP, type ModuleDef, type ModuleId } from "@/domain/modules"
import { cn } from "@/lib/cn"

interface ModuleCardProps {
  module: ModuleDef
  enabled: boolean
  onToggle?: (next: boolean) => void
  /** Modules currently enabled — used to show which "enhances" benefits are live. */
  enabledSet: Set<ModuleId>
  highlight?: boolean
  footer?: ReactNode
  badge?: ReactNode
}

/** One module: what it does, what it needs, what it unlocks. Used in onboarding and the Module Center. */
export function ModuleCard({ module, enabled, onToggle, enabledSet, highlight, footer, badge }: ModuleCardProps) {
  const Icon = MODULE_ICON[module.id]
  return (
    <Card id={`module-${module.id}`} className={cn("h-full gap-3 p-4 transition", enabled && "ring-1 ring-accent/40", highlight && "ring-2 ring-accent")}>
      <div className="flex items-start gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", enabled ? "bg-accent text-accent-foreground" : "bg-default text-muted")}>
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{module.name}</h3>
            {module.core && (
              <Chip size="sm" variant="soft">
                Inti
              </Chip>
            )}
            {badge}
          </div>
          <p className="mt-0.5 text-sm text-muted">{module.summary}</p>
        </div>
        {onToggle && !module.core && (
          <Switch isSelected={enabled} onChange={onToggle} aria-label={`${enabled ? "Nonaktifkan" : "Aktifkan"} ${module.name}`}>
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
        <div className="mt-auto space-y-1.5 border-t border-separator pt-3 text-xs">
          {module.requires.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Link2 className="size-3.5 text-muted" aria-hidden />
              <span className="text-muted">Butuh:</span>
              {module.requires.map((r) => (
                <Chip key={r} size="sm" variant="soft" color={enabledSet.has(r) ? "success" : "warning"}>
                  {MODULE_MAP[r].name}
                </Chip>
              ))}
            </div>
          )}
          {module.enhances.map((e) => (
            <div key={e.module} className="flex gap-1.5 text-muted">
              <Sparkles className={cn("mt-0.5 size-3.5 shrink-0", enabledSet.has(e.module) ? "text-accent" : "text-muted")} aria-hidden />
              <span>
                <b className={enabledSet.has(e.module) ? "text-foreground" : undefined}>+ {MODULE_MAP[e.module].name}:</b> {e.benefit}
              </span>
            </div>
          ))}
        </div>
      )}
      {footer}
    </Card>
  )
}
