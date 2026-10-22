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

const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null
const pending = new Map<string, { value: string; timer: number }>()

function flush(name: string) {
  const entry = pending.get(name)
  if (!entry) return
  pending.delete(name)
  void set(name, entry.value).then(() => channel?.postMessage(name))
}

// Don't lose the last change when the tab closes mid-debounce.
if (typeof window !== "undefined") window.addEventListener("pagehide", () => [...pending.keys()].forEach(flush))

export const idbStorage: StateStorage = {
  getItem: async (name) => (await get<string>(name)) ?? null,
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
