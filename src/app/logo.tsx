export function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="9" className="fill-accent" />
        <path d="M13 8h6v5h5v6h-5v5h-6v-5H8v-6h5z" className="fill-accent-foreground" />
      </svg>
      {!compact && (
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-tight">Medisphere</div>
          <div className="text-[11px] text-muted">Hospital OS</div>
        </div>
      )}
    </div>
  )
}
