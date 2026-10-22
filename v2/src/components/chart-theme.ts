/** Chart roles (see the --chart-* tokens in index.css). Categorical slots are assigned in fixed order. */
export const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"] as const

export const axisProps = {
  stroke: "var(--chart-axis)",
  tick: { fill: "var(--chart-axis)", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const

export const gridProps = { stroke: "var(--chart-grid)", vertical: false } as const
