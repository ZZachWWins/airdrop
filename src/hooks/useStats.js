import { useEffect, useState } from 'react'
import { fetchStats } from '../lib/api'

const REFRESH_MS = 30_000

/** Campaign-wide counters, polled so the home page feels live. */
export function useStats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const data = await fetchStats()
        if (!cancelled) setStats(data)
      } catch {
        // Keep the last good numbers rather than flashing zeros.
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    const id = setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return { stats, loading }
}
