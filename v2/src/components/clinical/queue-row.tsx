/**
 * One patient in a queue: ticket, wristband-style identity, where they are going, and how
 * long they have waited (red past the wait-time threshold, 60 minutes by default).
 */
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ageLabel } from "@v2/domain/clinical"
import type { Patient } from "@v2/domain/types"
import { cn } from "@v2/lib/cn"
import { formatDuration } from "@v2/lib/format"
import { QueueTicket } from "./queue-ticket"
import { MarkerDots } from "./wristband"

interface QueueRowProps {
  ticket?: string
  patient: Patient
  /** Second column: destination, provider, chief complaint… */
  detail?: ReactNode
  badges?: ReactNode
  /** Minutes waited; omitted when no longer waiting. */
  waited?: number
  /** Threshold (minutes) after which the wait is shown as overdue. */
  waitLimit?: number
  actions?: ReactNode
  highlight?: boolean
  muted?: boolean
}

/** Rows share one column grid (CSS subgrid), so tickets, names and waits line up. */
export function QueueList({ children }: { children: ReactNode }) {
  return <ul className="md:grid md:grid-cols-[5.5rem_minmax(12rem,1.5fr)_minmax(0,1fr)_auto_auto] md:gap-x-4">{children}</ul>
}

export function QueueRow({ ticket, patient, detail, badges, waited, waitLimit = 60, actions, highlight, muted }: QueueRowProps) {
  const late = waited !== undefined && waited > waitLimit
  return (
    <li className={cn("grid grid-cols-[5.5rem_1fr] items-center gap-x-4 gap-y-2 border-b border-separator px-5 py-3 last:border-b-0 md:col-span-full md:grid-cols-subgrid", highlight && "bg-accent-soft/40", muted && "opacity-60")}>
      <div>
        <QueueTicket number={ticket} tone={highlight ? "accent" : "default"} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Link to={`/patients/${patient.id}`} className="truncate font-semibold hover:underline">
            {patient.name}
          </Link>
          <MarkerDots patient={patient} />
        </div>
        <div className="num truncate text-xs text-muted">
          {patient.gender === "female" ? "F" : "M"} · {ageLabel(patient.birthDate)} · MRN {patient.mrn}
        </div>
      </div>
      <div className="col-span-2 min-w-0 text-sm md:col-span-1">{detail}</div>
      <div className="col-span-2 flex flex-wrap items-center gap-1.5 md:col-span-1 md:justify-end">
        {badges}
        <span className={cn("num w-16 text-right text-sm", late ? "font-semibold text-danger" : "text-muted")} title="Time waiting">
          {waited !== undefined ? formatDuration(waited) : ""}
        </span>
      </div>
      <div className="col-span-2 flex justify-end gap-1.5 md:col-span-1">{actions}</div>
    </li>
  )
}
