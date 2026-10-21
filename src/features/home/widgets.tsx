import { ArrowRight } from "lucide-react"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { Panel } from "@/components/ui/panel"

/** A worklist preview on the home page: a few rows and a link to the full list. */
export function WorkList({ title, description, to, linkLabel = "Buka", children, empty }: { title: string; description?: string; to: string; linkLabel?: string; children: ReactNode[]; empty: string }) {
  return (
    <Panel
      title={title}
      description={description}
      actions={
        <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
          {linkLabel} <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      }
      flush
    >
      {children.length ? <ul className="divide-y divide-separator">{children}</ul> : <p className="px-5 py-6 text-sm text-muted">{empty}</p>}
    </Panel>
  )
}

export function WorkRow({ to, title, sub, aside }: { to: string; title: ReactNode; sub?: ReactNode; aside?: ReactNode }) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-secondary">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{title}</div>
          {sub && <div className="truncate text-xs text-muted">{sub}</div>}
        </div>
        {aside}
      </Link>
    </li>
  )
}
