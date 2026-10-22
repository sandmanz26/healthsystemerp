import { LAB_MAP, PANEL_MAP } from "@/domain/catalog"
import type { ServiceOrder } from "@/domain/types"

/** Cap colours follow the CLSI GP41 order-of-draw convention. */
const TUBE_COLOUR: [prefix: string, colour: string][] = [
  ["Lavender", "#a78bfa"],
  ["Gold", "#d4a62a"],
  ["Light green", "#7fd49b"],
  ["Grey", "#9ca3af"],
  ["Light blue", "#7cc4f0"],
  ["Aerobic", "#3b6fd8"],
  ["Urine", "#f2cf3a"],
]

export const tubeColour = (tube: string) => TUBE_COLOUR.find(([p]) => tube.startsWith(p))?.[1] ?? "var(--muted)"

/** Panels in an order (lab bills and draws per panel, not per analyte). */
export const orderPanels = (order: ServiceOrder) => [...new Set(order.testCodes.map((c) => LAB_MAP[c]?.panel ?? c))].map((p) => PANEL_MAP[p]).filter(Boolean)
