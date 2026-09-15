import { useNetwork } from '../../hooks/useNetwork'
import { NETWORK_LABEL } from '../../lib/config'
import './NetworkBadge.css'

/**
 * Live chain tip. The block number ticks up while the page sits open, which
 * does more to show the testnet is running than any amount of copy claiming
 * it — and it is the same node every verification is checked against.
 */
export const NetworkBadge = () => {
  const network = useNetwork()

  // Before the first poll returns, say nothing about liveness either way.
  const state = !network ? 'pending' : network.online ? 'live' : 'degraded'

  return (
    <div className={`network-badge ${state}`}>
      <span className="network-dot" />
      {state === 'live' && (
        <>
          <span>{NETWORK_LABEL} is live</span>
          <span className="network-sep" />
          <span className="network-block mono">
            block {Number(network.blockHeight ?? 0).toLocaleString()}
          </span>
        </>
      )}
      {state === 'degraded' && <span>{NETWORK_LABEL} node unreachable</span>}
      {state === 'pending' && <span>Checking {NETWORK_LABEL}…</span>}
    </div>
  )
}
