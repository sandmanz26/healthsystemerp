/**
 * Locale formatting. Every date/number shown to a user goes through here so the whole app
 * agrees on one format — and follows the facility's region (US: "Oct 22, 2026, 2:05 PM",
 * $; UK: "22 Oct 2026, 14:05", £; temperatures in °F or °C).
 */
import { REGIONS, type Region } from "@/domain/region"

let region: Region = "us"
let money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
let number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 })
let dateFmt = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" })
let dateLong = new Intl.DateTimeFormat("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
let timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" })

/** Called whenever the facility region changes (see store/index.ts). */
export function setFormatRegion(next: Region) {
  if (next === region) return
  region = next
  const { locale, currency } = REGIONS[next]
  money = new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 })
  number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" })
  dateLong = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  timeFmt = new Intl.DateTimeFormat(locale, next === "uk" ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : { hour: "numeric", minute: "2-digit" })
}

export const currentRegion = () => region

export const formatMoney = (n: number) => money.format(n)
export const formatNumber = (n: number) => number.format(n)
export const formatPercent = (n: number) => `${number.format(n)}%`
export const formatDate = (iso: string) => dateFmt.format(new Date(iso))
export const formatDateLong = (iso: string | Date) => dateLong.format(new Date(iso))
export const formatTime = (iso: string) => timeFmt.format(new Date(iso))
export const formatDateTime = (iso: string) => `${formatDate(iso)}, ${formatTime(iso)}`

/** Temperature is stored in °C; US charts show °F. */
export function formatTemp(celsius: number | undefined): string {
  if (celsius === undefined) return "—"
  return region === "us" ? `${(celsius * 9 / 5 + 32).toFixed(1)} °F` : `${celsius.toFixed(1)} °C`
}
export const tempUnit = () => (region === "us" ? "°F" : "°C")
export const toDisplayTemp = (c: number) => (region === "us" ? Math.round((c * 9 / 5 + 32) * 10) / 10 : c)
export const fromDisplayTemp = (v: number) => (region === "us" ? Math.round(((v - 32) * 5 / 9) * 10) / 10 : v)

/** Weight is stored in kg; US charts show lb (with kg for dosing). */
export function formatWeight(kg: number | undefined): string {
  if (kg === undefined) return "—"
  return region === "us" ? `${Math.round(kg * 2.20462)} lb (${kg} kg)` : `${kg} kg`
}

/** "5 min", "2 h 10 min", "3 d" — compact durations for worklists. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  if (minutes < 60 * 24) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m ? `${h} h ${m} min` : `${h} h`
  }
  return `${Math.floor(minutes / 1440)} d`
}

/** "just now", "12 min ago", "yesterday" … */
export function formatRelative(iso: string, now = Date.now()): string {
  const min = Math.round((now - new Date(iso).getTime()) / 60000)
  if (min < 1) return "just now"
  if (min < 60 * 24) return `${formatDuration(min)} ago`
  const days = Math.round(min / 1440)
  return days === 1 ? "yesterday" : `${days} days ago`
}

/** yyyy-mm-dd in local time (not UTC — night shifts must not jump a day). */
export function dayKey(d: Date | string | number = new Date()): string {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`
}

export const isToday = (iso: string) => dayKey(iso) === dayKey()

export function initials(name: string): string {
  return name
    .replace(/^(dr|mr|mrs|ms|prof)\.?\s+/i, "")
    .replace(/,.*$/, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("")
}
