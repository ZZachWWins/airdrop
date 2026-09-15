/**
 * Client for the campaign API (Netlify Functions, same origin under /api).
 */

/** Error carrying the server's machine-readable `reason`, so the UI can react. */
export class ApiError extends Error {
  constructor(message, { status, reason } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.reason = reason
  }
}

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    })
  } catch {
    throw new ApiError('Could not reach the verification service. Check your connection.', {
      reason: 'network',
    })
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(data?.error || `Request failed (${response.status}).`, {
      status: response.status,
      reason: data?.reason,
    })
  }

  return data
}

/** Ask for a single-use message to sign. */
export function requestChallenge(address) {
  return request('/challenge', {
    method: 'POST',
    body: JSON.stringify({ address }),
  })
}

/** Submit the signature (and optionally the invite code that brought you here). */
export function submitVerification({ address, nonce, signature, inviteCode }) {
  return request('/verify', {
    method: 'POST',
    body: JSON.stringify({ address, nonce, signature, inviteCode: inviteCode || undefined }),
  })
}

export function fetchStatus(address) {
  return request(`/status?address=${encodeURIComponent(address)}`)
}

export function fetchStats() {
  return request('/stats')
}

/** Live chain tip from the node verifications are checked against. */
export function fetchNetwork() {
  return request('/network')
}

export function fetchLeaderboard(limit = 25) {
  return request(`/leaderboard?limit=${limit}`)
}

export function lookupInvite(code) {
  return request(`/invite?code=${encodeURIComponent(code)}`)
}

// ── Mainnet claim ──────────────────────────────────────────────────────────

export function fetchClaimStatus(address) {
  return request(`/claim?address=${encodeURIComponent(address)}`)
}

/**
 * The payout address goes in at challenge time, not claim time — it has to be
 * inside the text the wallet signs. The returned `message` is what the user
 * will be shown and asked to approve.
 */
export function requestClaimChallenge({ address, mainnetAddress }) {
  return request('/claim/challenge', {
    method: 'POST',
    body: JSON.stringify({ address, mainnetAddress }),
  })
}

export function submitClaim({ address, nonce, signature }) {
  return request('/claim', {
    method: 'POST',
    body: JSON.stringify({ address, nonce, signature }),
  })
}
