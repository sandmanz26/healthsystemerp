/**
 * Locale formatting (id-ID). Every date/number shown to a user goes through here so the
 * whole app agrees on one format.
 */
const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })
const number = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 })
const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" })
const dateLong = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
const timeFmt = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" })

export const formatRupiah = (n: number) => rupiah.format(n)
export const formatNumber = (n: number) => number.format(n)
export const formatPercent = (n: number) => `${number.format(n)}%`
export const formatDate = (iso: string) => dateFmt.format(new Date(iso))
export const formatDateLong = (iso: string | Date) => dateLong.format(new Date(iso))
export const formatTime = (iso: string) => timeFmt.format(new Date(iso))
export const formatDateTime = (iso: string) => `${formatDate(iso)}, ${formatTime(iso)}`

/** "5 mnt", "2 jam 10 mnt", "3 hari" — compact durations for worklists. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} mnt`
  if (minutes < 60 * 24) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m ? `${h} jam ${m} mnt` : `${h} jam`
  }
  return `${Math.floor(minutes / 1440)} hari`
}

/** "baru saja", "12 mnt lalu", "kemarin" … */
export function formatRelative(iso: string, now = Date.now()): string {
  const min = Math.round((now - new Date(iso).getTime()) / 60000)
  if (min < 1) return "baru saja"
  if (min < 60 * 24) return `${formatDuration(min)} lalu`
  const days = Math.round(min / 1440)
  return days === 1 ? "kemarin" : `${days} hari lalu`
}

/** yyyy-mm-dd in local time (not UTC — night shifts must not jump a day). */
export function dayKey(d: Date | string | number = new Date()): string {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`
}

export const isToday = (iso: string) => dayKey(iso) === dayKey()

export function initials(name: string): string {
  return name
    .replace(/^(dr|drg|Ns|apt|Dr)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("")
}
