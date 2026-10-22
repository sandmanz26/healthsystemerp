/**
 * Decorative wristband barcode derived from the medical-record number, so the same patient
 * always shows the same pattern (it is a visual cue, not a scannable symbology).
 */
export function Barcode({ value, height = 32, className }: { value: string; height?: number; className?: string }) {
  const bars: { x: number; w: number }[] = []
  let x = 0
  for (const ch of `*${value}*`) {
    const code = ch.charCodeAt(0)
    for (let i = 0; i < 4; i++) {
      const w = ((code >> i) & 1) + 1
      if (i % 2 === 0) bars.push({ x, w })
      x += w + 1
    }
  }
  return (
    <svg viewBox={`0 0 ${x} ${height}`} height={height} preserveAspectRatio="none" className={className} aria-hidden>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={height} fill="currentColor" />
      ))}
    </svg>
  )
}
