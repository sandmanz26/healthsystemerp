import { useCallback, useEffect, useState } from "react"

/**
 * State that survives navigation and reloads (localStorage). Clinicians are interrupted
 * constantly; a half-written note must still be there when they come back.
 */
export function useDraft<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void, () => void] {
  const storageKey = `medisphere-draft:${key}`
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value))
    } catch {
      // Storage full or blocked: the draft just won't persist.
    }
  }, [storageKey, value])

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(storageKey)
    } catch {
      /* ignore */
    }
    setValue(initial)
    // `initial` is a fresh literal each render; clearing should use the first one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  return [value, setValue, clear]
}
