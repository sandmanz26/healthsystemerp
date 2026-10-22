/** Mark: a pulse trace in an ink square, then the product name. */
export function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-2">
      <svg viewBox="0 0 32 32" className="size-6 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="7" className="fill-foreground" />
        <path d="M5 17h5.5l2-5.5 3.5 11 3-8 1.8 2.5H27" fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="stroke-background" />
      </svg>
      {!compact && <span className="text-[15px] font-semibold">Medisphere</span>}
    </div>
  )
}
