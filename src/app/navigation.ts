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
import { MODULE_MAP, type ModuleCategory, type ModuleId } from "@/domain/modules"
import type { RoleId } from "@/domain/types"

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  /** Visible when any of these modules is on. Empty = always. */
  modules: ModuleId[]
  group: ModuleCategory | "home"
  /** Override module roles (e.g. Module Center is admin-only). */
  roles?: RoleId[]
}

export const NAV: NavItem[] = [
  { path: "/", label: "Beranda", icon: LayoutDashboard, modules: [], group: "home" },
  { path: "/patients", label: "Pasien", icon: Users, modules: ["patients"], group: "core" },
  { path: "/registration", label: "Pendaftaran", icon: Ticket, modules: ["registration"], group: "front" },
  { path: "/appointments", label: "Jadwal & Janji", icon: CalendarClock, modules: ["appointments"], group: "front" },
  { path: "/outpatient", label: "Rawat Jalan", icon: Stethoscope, modules: ["outpatient"], group: "clinical" },
  { path: "/emergency", label: "IGD", icon: Siren, modules: ["emergency"], group: "clinical" },
  { path: "/inpatient", label: "Rawat Inap", icon: BedDouble, modules: ["inpatient"], group: "clinical" },
  { path: "/nursing", label: "Keperawatan", icon: HeartPulse, modules: ["nursing"], group: "clinical" },
  { path: "/surgery", label: "Kamar Operasi", icon: Scissors, modules: ["surgery"], group: "clinical" },
  { path: "/laboratory", label: "Laboratorium", icon: FlaskConical, modules: ["laboratory"], group: "support" },
  { path: "/radiology", label: "Radiologi", icon: ScanLine, modules: ["radiology"], group: "support" },
  { path: "/pharmacy", label: "Farmasi", icon: Pill, modules: ["pharmacy"], group: "support" },
  { path: "/billing", label: "Kasir", icon: Receipt, modules: ["billing"], group: "finance" },
  { path: "/claims", label: "Klaim & Casemix", icon: FileHeart, modules: ["claims"], group: "finance" },
  { path: "/inventory", label: "Inventori", icon: Boxes, modules: ["inventory"], group: "operations" },
  { path: "/hr", label: "SDM & Jadwal Jaga", icon: UsersRound, modules: ["hr"], group: "operations" },
  { path: "/quality", label: "Mutu & IKP", icon: ShieldAlert, modules: ["quality"], group: "quality" },
  { path: "/reports", label: "Laporan", icon: BarChart3, modules: ["reports"], group: "quality" },
  { path: "/integrations", label: "Integrasi", icon: PlugZap, modules: ["bpjs", "satusehat"], group: "integration", roles: ["admin", "coder", "frontdesk"] },
  { path: "/modules", label: "Pusat Modul", icon: Puzzle, modules: [], group: "core", roles: ["admin", "manager"] },
  { path: "/settings", label: "Pengaturan", icon: Settings, modules: ["settings"], group: "core", roles: ["admin"] },
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
  bpjs: Activity,
  satusehat: PlugZap,
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
