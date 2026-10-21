/** Short, sortable, collision-safe-enough ids for client-side records. */
export function uid(prefix = ""): string {
  const time = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 7)
  return `${prefix}${time}${rand}`
}
