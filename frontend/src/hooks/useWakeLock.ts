import { useEffect, useRef, useState, useCallback } from "react"

type WakeLockSentinel = {
  released: boolean
  type: "screen"
  release: () => Promise<void>
  addEventListener: (ev: "release", cb: () => void) => void
  removeEventListener: (ev: "release", cb: () => void) => void
}

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinel>
  }
}

export function useWakeLock(enabled: boolean = true) {
  const [isActive, setIsActive] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const sentinelRef = useRef<WakeLockSentinel | null>(null)
  const wantsLockRef = useRef(enabled)

  const requestLock = useCallback(async () => {
    if (!enabled) return
    const nav = navigator as NavigatorWithWakeLock
    if (!nav.wakeLock) return
    if (sentinelRef.current && !sentinelRef.current.released) return

    try {
      const sentinel = await nav.wakeLock.request("screen")
      sentinelRef.current = sentinel
      setIsActive(true)

      sentinel.addEventListener("release", () => {
        sentinelRef.current = null
        setIsActive(false)
      })
    } catch {
      setIsActive(false)
    }
  }, [enabled])

  const releaseLock = useCallback(async () => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    try {
      await sentinel.release()
    } catch {
    } finally {
      sentinelRef.current = null
      setIsActive(false)
    }
  }, [])

  useEffect(() => {
    wantsLockRef.current = enabled
  }, [enabled])

  useEffect(() => {
    const nav = navigator as NavigatorWithWakeLock
    const supported = !!nav.wakeLock
    setIsSupported(supported)

    if (!supported) return

    if (enabled) requestLock()
    else releaseLock()

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && wantsLockRef.current) {
        requestLock()
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
      releaseLock()
    }
  }, [enabled, requestLock, releaseLock])

  return { isActive, isSupported, requestLock, releaseLock }
}