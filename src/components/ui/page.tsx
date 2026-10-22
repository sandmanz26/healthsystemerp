import type { ReactNode } from "react"
import { useLocation } from "react-router-dom"
import { CATEGORY_COLOR, navForPath, navLabel } from "@/app/navigation"
import { CATEGORY_LABEL } from "@/domain/modules"
import { cn } from "@/lib/cn"
import { useRegion } from "@/store/selectors"

interface PageHeaderProps {
  title: string
  description?: ReactNode
  /** Primary actions, right-aligned on desktop. */
  actions?: ReactNode
  /** Overrides the automatic "CATEGORY · PAGE" index label. */
  eyebrow?: ReactNode
}

/**
 * Page title set like a chart divider: a coloured index tab with the module's category,
 * then the title in the display face.
 */
export function PageHeader({ title, description, actions, eyebrow }: PageHeaderProps) {
  const { pathname } = useLocation()
  const nav = navForPath(pathname)
  const region = useRegion()
  const group = nav?.group ?? "home"
  return (
    <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="mb-1.5 flex items-center gap-2">
          <span className={cn("h-3.5 w-1.5 rounded-sm", CATEGORY_COLOR[group])} aria-hidden />
          <span className="label-caps text-muted">{eyebrow ?? (group === "home" ? "Home" : `${CATEGORY_LABEL[group]} · ${nav ? navLabel(nav, region) : title}`)}</span>
        </div>
        <h1 className="text-[22px] font-semibold leading-tight text-foreground sm:text-[26px]">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-[13px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-8", className)}>{children}</div>
}

interface SectionProps {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}

/** A titled block inside a page, without a card around it. */
export function Section({ title, description, actions, children, className }: SectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}
