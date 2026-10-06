import { useCallback, useEffect, useRef, useState } from "react"

type Options = {
  intervalMs?: number
  enabled?: boolean
}

export function useAutoRefresh<T>(
  fetcher: () => Promise<T>,
  { intervalMs = 60_000, enabled = true }: Options = {}
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fetcherRef = useRef(fetcher)

  useEffect(() => { fetcherRef.current = fetcher }, [fetcher])

  const run = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetcherRef.current()
      setData(res)
      setLastUpdated(new Date())
      setError(null)
    } catch (e) {
      setError((e as Error).message || "Gagal memuat data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    run()
    const id = setInterval(run, intervalMs)
    return () => clearInterval(id)
  }, [enabled, intervalMs, run])

  return { data, loading, error, lastUpdated, refresh: run }
}