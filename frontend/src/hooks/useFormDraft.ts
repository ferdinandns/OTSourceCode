import { useEffect, useRef } from "react"
import type React from "react"

const DEFAULT_DEBOUNCE_MS = 400

export function useFormDraft<T>(
  key: string,
  active: boolean,
  form: T,
  setForm: React.Dispatch<React.SetStateAction<T>>,
  debounceMs: number = DEFAULT_DEBOUNCE_MS
): void {
  const loadedForKeyRef = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const latestFormRef = useRef(form)
  const latestKeyRef = useRef(key)
  latestFormRef.current = form
  latestKeyRef.current = key

  const flushNow = () => {
    try {
      window.localStorage.setItem(latestKeyRef.current, JSON.stringify(latestFormRef.current))
    } catch {
    }
  }

  useEffect(() => {
    if (!active) {
      loadedForKeyRef.current = null
      return
    }
    if (loadedForKeyRef.current === key) return
    loadedForKeyRef.current = key

    try {
      const raw = window.localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw) as T
        setForm(parsed)
      }
    } catch {
    }
  }, [active, key, setForm])

  useEffect(() => {
    if (!active) return

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flushNow, debounceMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, form, debounceMs])

  useEffect(() => {
    if (!active) return
    return () => {
      flushNow()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  useEffect(() => {
    if (!active) return
    window.addEventListener("beforeunload", flushNow)
    window.addEventListener("pagehide", flushNow)
    return () => {
      window.removeEventListener("beforeunload", flushNow)
      window.removeEventListener("pagehide", flushNow)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
}

export function clearFormDraft(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
  }
}