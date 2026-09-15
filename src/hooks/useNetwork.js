import { useEffect, useState } from 'react'
import { fetchNetwork } from '../lib/api'

const REFRESH_MS = 12_000

/**
 * Live chain tip, polled so the block number visibly advances while someone
 * reads the page. That movement is the point: it is the difference between
 * claiming the testnet is live and showing it.
 */
export function useNetwork() {
  const [network, setNetwork] = useState(null)

  useEffect(() => {
    let cancelled = false

    const load = () =>
      fetchNetwork()
        .then((data) => {
          if (!cancelled) setNetwork(data)
        })
        .catch(() => {
          // Keep the last known tip rather than flashing an offline state on
          // one dropped poll.
        })

    load()
    const id = setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return network
}
