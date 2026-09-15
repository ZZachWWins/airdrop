/**
 * Server-side reads against the Xeris testnet node.
 *
 * These run inside a Netlify Function, so they hit the node directly — no CORS
 * proxy and, more importantly, no way for a caller to forge the result. The
 * snapshot this produces is what makes a verification a *testnet* verification
 * rather than just a signature.
 */

const NODE_URL = (process.env.XERIS_NODE_URL || 'https://rpc.xerisweb.com').replace(/\/$/, '')
const NETWORK_ID = process.env.XERIS_NETWORK_ID || 'xeris-testnet'
const TIMEOUT_MS = Number(process.env.XERIS_NODE_TIMEOUT_MS || 8000)

export class NodeUnreachableError extends Error {
  constructor(message) {
    super(message)
    this.name = 'NodeUnreachableError'
  }
}

async function nodeFetch(path) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`${NODE_URL}${path}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    return response
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The current chain tip. Doubles as a liveness probe: if this fails we refuse
 * to record a verification rather than accept one we could not anchor.
 *
 * The node does not expose getLatestBlockhash on this port, so we read the
 * recent-blocks list and take the newest — the same approach XerisLaunchpad's
 * xerisService uses.
 */
export async function fetchChainTip() {
  let response
  try {
    response = await nodeFetch('/blocks')
  } catch (err) {
    throw new NodeUnreachableError(`Could not reach the Xeris node: ${err.message}`)
  }

  if (!response.ok) {
    throw new NodeUnreachableError(`Xeris node returned HTTP ${response.status}`)
  }

  const body = await response.json().catch(() => null)
  const blocks = Array.isArray(body) ? body : (body?.blocks ?? [])
  const latest = blocks[0]
  if (!latest) throw new NodeUnreachableError('Xeris node returned no blocks')

  return {
    height: latest.height ?? latest.slot ?? latest.index ?? null,
    hash: typeof latest.hash === 'string' ? latest.hash : null,
    observedAt: Date.now(),
  }
}

/** Native XRS balance in lamports, or 0 when the account is unknown. */
async function fetchNativeBalance(address) {
  try {
    const response = await nodeFetch(`/token/balance/${address}/xrs_native`)
    if (!response.ok) return 0
    const data = await response.json()
    return Number(data.balance ?? data.lamports ?? 0) || 0
  } catch {
    return 0
  }
}

/**
 * Account metadata. The nonce is the useful signal — a non-zero nonce means
 * the address has actually sent transactions on this network.
 */
async function fetchAccount(address) {
  try {
    const response = await nodeFetch(`/account/${address}`)
    if (!response.ok) return null
    const data = await response.json()
    return data?.account ?? data ?? null
  } catch {
    return null
  }
}

/**
 * Build the on-chain snapshot stored alongside a verification.
 *
 * Presence on testnet is *recorded*, not required: a wallet created minutes ago
 * has a zero balance and no nonce, and refusing those would punish exactly the
 * new users a testnet campaign is trying to attract. `activity` is what a
 * future mainnet distribution can weight by.
 *
 * @throws {NodeUnreachableError} when the node cannot be reached at all.
 */
export async function buildChainSnapshot(address) {
  // Tip first — if the node is down this throws and the caller returns 503
  // rather than writing an unanchored record.
  const tip = await fetchChainTip()
  const [balanceLamports, account] = await Promise.all([
    fetchNativeBalance(address),
    fetchAccount(address),
  ])

  const nonce = Number(account?.nonce ?? 0) || 0
  const hasBalance = balanceLamports > 0
  const hasSentTx = nonce > 0

  return {
    network: NETWORK_ID,
    nodeUrl: NODE_URL,
    blockHeight: tip.height,
    blockHash: tip.hash,
    checkedAt: tip.observedAt,
    accountFound: Boolean(account),
    balanceLamports,
    nonce,
    // Tiers, cheapest to strongest. Recorded now so a mainnet distribution can
    // weight by real testnet usage without re-deriving history later.
    activity: hasSentTx ? 'active' : hasBalance ? 'funded' : 'new',
  }
}

export { NETWORK_ID, NODE_URL }
