/**
 * Navigation registry: maps modules to routes, labels and icons. The sidebar, command
 * palette and route guard all read from here, so a module that is off disappears
 * everywhere at once.
 */
import {
  Activity, BarChart3, BedDouble, Boxes, CalendarClock, ClipboardList, FileHeart, FlaskConical, HeartPulse, LayoutDashboard,
  type LucideIcon, Pill, PlugZap, Receipt, ScanLine, Scissors, Settings, ShieldAlert, Siren, Stethoscope, Ticket, Users, UsersRound,
  Puzzle,
} from "lucide-react"
import { MODULE_MAP, type ModuleCategory, type ModuleId } from "@v2/domain/modules"
import type { Region } from "@v2/domain/region"
import type { RoleId } from "@v2/domain/types"

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  /** Visible when any of these modules is on. Empty = always. */
  modules: ModuleId[]
  group: ModuleCategory | "home"
  /** Override module roles (e.g. Module Center is admin-only). */
  roles?: RoleId[]
  /** UK/NHS wording where it differs from the US label (e.g. "A&E", "Wards"). */
  ukLabel?: string
}

/** The label staff in this market would expect. */
export const navLabel = (item: NavItem, region: Region) => (region === "uk" && item.ukLabel) || item.label

export const NAV: NavItem[] = [
  { path: "/", label: "Home", icon: LayoutDashboard, modules: [], group: "home" },
  { path: "/patients", label: "Patients", icon: Users, modules: ["patients"], group: "core" },
  { path: "/registration", label: "Registration", icon: Ticket, modules: ["registration"], group: "front" },
  { path: "/appointments", label: "Scheduling", ukLabel: "Appointments", icon: CalendarClock, modules: ["appointments"], group: "front" },
  { path: "/outpatient", label: "Ambulatory", ukLabel: "Outpatients", icon: Stethoscope, modules: ["outpatient"], group: "clinical" },
  { path: "/emergency", label: "Emergency Dept", ukLabel: "A&E", icon: Siren, modules: ["emergency"], group: "clinical" },
  { path: "/inpatient", label: "Inpatient", ukLabel: "Wards", icon: BedDouble, modules: ["inpatient"], group: "clinical" },
  { path: "/nursing", label: "Nursing", icon: HeartPulse, modules: ["nursing"], group: "clinical" },
  { path: "/surgery", label: "Surgery / OR", ukLabel: "Theatres", icon: Scissors, modules: ["surgery"], group: "clinical" },
  { path: "/laboratory", label: "Laboratory", ukLabel: "Pathology", icon: FlaskConical, modules: ["laboratory"], group: "support" },
  { path: "/radiology", label: "Imaging", icon: ScanLine, modules: ["radiology"], group: "support" },
  { path: "/pharmacy", label: "Pharmacy", icon: Pill, modules: ["pharmacy"], group: "support" },
  { path: "/billing", label: "Patient Accounts", ukLabel: "Private Billing", icon: Receipt, modules: ["billing"], group: "finance" },
  { path: "/claims", label: "Coding & Claims", ukLabel: "Coding & SUS+", icon: FileHeart, modules: ["claims"], group: "finance" },
  { path: "/inventory", label: "Supply Chain", icon: Boxes, modules: ["inventory"], group: "operations" },
  { path: "/hr", label: "Workforce & Staffing", ukLabel: "Workforce & Rota", icon: UsersRound, modules: ["hr"], group: "operations" },
  { path: "/quality", label: "Quality & Safety", icon: ShieldAlert, modules: ["quality"], group: "quality" },
  { path: "/reports", label: "Analytics", icon: BarChart3, modules: ["reports"], group: "quality" },
  { path: "/integrations", label: "Interfaces", icon: PlugZap, modules: ["payer", "interop"], group: "integration", roles: ["admin", "coder", "frontdesk"] },
  { path: "/modules", label: "Module Center", ukLabel: "Module Centre", icon: Puzzle, modules: [], group: "core", roles: ["admin", "manager"] },
  { path: "/settings", label: "Settings", icon: Settings, modules: ["settings"], group: "core", roles: ["admin"] },
]

/** Icon per module, for cards in the Module Center. */
export const MODULE_ICON: Record<ModuleId, LucideIcon> = {
  patients: Users,
  settings: Settings,
  registration: Ticket,
  appointments: CalendarClock,
  emr: ClipboardList,
  outpatient: Stethoscope,
  emergency: Siren,
  inpatient: BedDouble,
  nursing: HeartPulse,
  surgery: Scissors,
  laboratory: FlaskConical,
  radiology: ScanLine,
  pharmacy: Pill,
  billing: Receipt,
  claims: FileHeart,
  inventory: Boxes,
  hr: UsersRound,
  quality: ShieldAlert,
  reports: BarChart3,
  payer: Activity,
  interop: PlugZap,
}

export function isNavVisible(item: NavItem, enabled: Set<ModuleId>, role: RoleId): boolean {
  if (item.modules.length && !item.modules.some((m) => enabled.has(m))) return false
  // Admins configure everything, so they see every enabled module.
  if (role === "admin") return true
  if (item.roles) return item.roles.includes(role)
  if (!item.modules.length) return true
  return item.modules.some((m) => MODULE_MAP[m].roles.includes(role))
}

/** Which nav item owns a path (longest prefix match). */
export function navForPath(pathname: string): NavItem | undefined {
  return [...NAV].sort((a, b) => b.path.length - a.path.length).find((n) => (n.path === "/" ? pathname === "/" : pathname.startsWith(n.path)))
}

/** Divider colour per module category (Tailwind classes from the cat-* tokens). */
export const CATEGORY_COLOR: Record<ModuleCategory | "home", string> = {
  home: "bg-accent",
  core: "bg-cat-core",
  front: "bg-cat-front",
  clinical: "bg-cat-clinical",
  support: "bg-cat-support",
  finance: "bg-cat-finance",
  operations: "bg-cat-operations",
  quality: "bg-cat-quality",
  integration: "bg-cat-integration",
}
