import { isValidAddress } from '../lib/base58.js'
import { buildChallengeMessage, createNonce, NONCE_TTL_MS } from '../lib/campaign.js'
import { putNonce } from '../lib/storage.js'
import { error, json, methodNotAllowed, readJson, siteDomain } from '../lib/http.js'

/**
 * POST /api/challenge  { address }
 *   -> { nonce, message, expiresAt }
 *
 * Step one of verification: hand the client a single-use nonce wrapped in the
 * exact text to sign. The message is stored server-side with the nonce so that
 * /api/verify checks the signature against what was actually issued, not
 * against something the client reconstructs and could vary.
 */
export default async function handler(request) {
  if (request.method !== 'POST') return methodNotAllowed('POST')

  const body = await readJson(request)
  const address = body?.address

  if (typeof address !== 'string' || !isValidAddress(address)) {
    return error('A valid Xeris wallet address is required.')
  }

  const nonce = createNonce()
  const issuedAt = Date.now()
  const message = buildChallengeMessage({
    address,
    nonce,
    issuedAt,
    domain: siteDomain(request),
  })

  await putNonce(nonce, { address, message, issuedAt })

  return json({ nonce, message, expiresAt: issuedAt + NONCE_TTL_MS })
}

export const config = { path: '/api/challenge' }
