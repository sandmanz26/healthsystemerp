/**
 * Persistence for the store. IndexedDB (via idb-keyval) instead of localStorage: the demo
 * dataset is a few MB, and localStorage's ~5 MB quota would eventually reject writes.
 * Writes are debounced (many actions can fire in one interaction) and announced on a
 * BroadcastChannel so other tabs — e.g. the waiting-room display — refresh.
 */
import { del, get, set } from "idb-keyval"
import type { StateStorage } from "zustand/middleware"

const CHANNEL = "medisphere-sync"
const WRITE_DELAY_MS = 250

/**
 * Whether the last write reached IndexedDB. Private windows and full disks reject writes;
 * the app keeps working in memory and the shell tells the user nothing is being saved.
 */
type Health = "ok" | "failed"
let health: Health = "ok"
const healthListeners = new Set<() => void>()
const setHealth = (next: Health) => {
  if (next === health) return
  health = next
  healthListeners.forEach((l) => l())
}
export const storageHealth = {
  get: () => health,
  subscribe: (l: () => void) => (healthListeners.add(l), () => void healthListeners.delete(l)),
}

const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null
const pending = new Map<string, { value: string; timer: number }>()

function flush(name: string) {
  const entry = pending.get(name)
  if (!entry) return
  pending.delete(name)
  try {
    set(name, entry.value).then(
      () => {
        setHealth("ok")
        channel?.postMessage(name)
      },
      () => setHealth("failed"),
    )
  } catch {
    // Some browsers throw synchronously when IndexedDB is disabled.
    setHealth("failed")
  }
}

// Don't lose the last change when the tab closes mid-debounce.
if (typeof window !== "undefined") window.addEventListener("pagehide", () => [...pending.keys()].forEach(flush))

export const idbStorage: StateStorage = {
  getItem: async (name) => {
    try {
      return (await get<string>(name)) ?? null
    } catch {
      setHealth("failed")
      return null
    }
  },
  setItem: (name, value) => {
    const prev = pending.get(name)
    if (prev) window.clearTimeout(prev.timer)
    pending.set(name, { value, timer: window.setTimeout(() => flush(name), WRITE_DELAY_MS) })
  },
  removeItem: (name) => del(name),
}

/** Calls `onChange` when another tab saved `name`. */
export function onExternalWrite(name: string, onChange: () => void) {
  if (!channel) return () => {}
  const listener = (e: MessageEvent) => {
    if (e.data === name) onChange()
  }
  channel.addEventListener("message", listener)
  return () => channel.removeEventListener("message", listener)
}
