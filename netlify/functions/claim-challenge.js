import { isValidAddress } from '../lib/base58.js'
import {
  NONCE_TTL_MS,
  PURPOSE,
  buildClaimMessage,
  claimPhase,
  createNonce,
} from '../lib/campaign.js'
import { getVerification, putNonce } from '../lib/storage.js'
import { error, json, methodNotAllowed, readJson, siteDomain } from '../lib/http.js'

/**
 * POST /api/claim/challenge  { address, mainnetAddress }
 *   -> { nonce, message, expiresAt, mainnetAddress }
 *
 * Step one of the mainnet claim. The payout address is supplied *here*, not at
 * claim time, because it has to be inside the text the wallet signs — see
 * buildClaimMessage. /api/claim then reads it back off the stored challenge
 * and ignores the request body entirely, so there is no point in the flow
 * where a payout address can be swapped without breaking the signature.
 *
 * `message` is returned so the UI can show the user exactly what they are
 * about to approve, pay-to address and all.
 */
export default async function handler(request) {
  if (request.method !== 'POST') return methodNotAllowed('POST')

  if (claimPhase() !== 'open') {
    return error('The mainnet claim window is not open yet.', 403, { reason: 'claim_closed' })
  }

  const body = await readJson(request)
  const address = body?.address
  const mainnetAddress =
    typeof body?.mainnetAddress === 'string' ? body.mainnetAddress.trim() : null

  if (typeof address !== 'string' || !isValidAddress(address)) {
    return error('A valid Xeris testnet wallet address is required.')
  }
  if (!mainnetAddress || !isValidAddress(mainnetAddress)) {
    return error(
      'Enter a valid Xeris mainnet address. Check it character by character — tokens sent to the wrong address cannot be recovered.',
      400,
      { reason: 'invalid_mainnet_address' },
    )
  }
  // The user told us these are different keypairs, so the testnet address in
  // the payout field is almost certainly a paste error — and a paste error
  // here means the tokens land somewhere unspendable.
  if (mainnetAddress === address) {
    return error(
      'That is your testnet address. Enter the mainnet address you want to be paid at.',
      400,
      { reason: 'same_as_testnet' },
    )
  }

  // Only verified testnet wallets can claim. Checked before issuing a
  // challenge so an ineligible wallet is told now, not after signing.
  const record = await getVerification(address)
  if (!record) {
    return error('This wallet did not verify during the testnet campaign.', 403, {
      reason: 'not_verified',
    })
  }

  const nonce = createNonce()
  const issuedAt = Date.now()
  const message = buildClaimMessage({
    testnetAddress: address,
    mainnetAddress,
    nonce,
    issuedAt,
    domain: siteDomain(request),
  })

  await putNonce(nonce, {
    address,
    mainnetAddress,
    message,
    issuedAt,
    purpose: PURPOSE.CLAIM,
  })

  return json({ nonce, message, mainnetAddress, expiresAt: issuedAt + NONCE_TTL_MS })
}

export const config = { path: '/api/claim/challenge' }
