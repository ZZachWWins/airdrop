import { maskAddress, normaliseCode } from '../lib/campaign.js'
import { countReferrals, getCodeOwner } from '../lib/storage.js'
import { json, methodNotAllowed } from '../lib/http.js'

/**
 * GET /api/invite?code=XRS-A1B2C3
 *   -> { valid, code, referrer?, referralCount? }
 *
 * Lets the landing page confirm an invite code before the visitor commits to
 * connecting a wallet — "invited by 7xQp…3kAf" reads very differently from an
 * unexplained code in the URL bar. Only the masked referrer is exposed.
 */
export default async function handler(request) {
  if (request.method !== 'GET') return methodNotAllowed('GET')

  const raw = new URL(request.url).searchParams.get('code')
  const code = normaliseCode(raw)
  if (!code) return json({ valid: false, reason: 'invalid_format' })

  const owner = await getCodeOwner(code)
  if (!owner) return json({ valid: false, code, reason: 'unknown_code' })

  return json({
    valid: true,
    code,
    referrer: maskAddress(owner),
    referralCount: await countReferrals(owner),
  })
}

export const config = { path: '/api/invite' }
