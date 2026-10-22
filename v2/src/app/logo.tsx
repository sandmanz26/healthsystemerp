/** Mark: a pulse trace inside a chart-binder square. */
export function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-9 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="9" className="fill-accent" />
        <path d="M5 17h5.5l2-5.5 3.5 11 3-8 1.8 2.5H27" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="stroke-accent-foreground" />
      </svg>
      {!compact && (
        <div className="leading-none">
          <div className="font-display text-[17px] font-bold tracking-tight">Medisphere</div>
          <div className="label-caps mt-1 text-muted">Hospital OS</div>
        </div>
      )}
    </div>
  )
}
