import { useEffect } from "react"

/** Global keyboard shortcut, e.g. useHotkey("k", open, { mod: true }). */
export function useHotkey(key: string, handler: () => void, opts: { mod?: boolean } = {}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (opts.mod && !(e.metaKey || e.ctrlKey)) return
      if (e.key.toLowerCase() !== key.toLowerCase()) return
      e.preventDefault()
      handler()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [key, handler, opts.mod])
}
