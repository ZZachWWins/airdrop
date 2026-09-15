import { isValidAddress } from '../lib/base58.js'
import { maskAddress, toPublicRecord } from '../lib/campaign.js'
import { getVerification, listReferees, verificationsStore } from '../lib/storage.js'
import { error, json, methodNotAllowed } from '../lib/http.js'

/**
 * GET /api/status?address=<address>
 *   -> { verified: false } | { record: {...}, referrals: [...] }
 *
 * The frontend calls this on connect to decide which screen to show. It reads
 * public campaign state for an address, so it needs no signature — but it also
 * returns nothing an observer could not already derive from the chain.
 */
export default async function handler(request) {
  if (request.method !== 'GET') return methodNotAllowed('GET')

  const address = new URL(request.url).searchParams.get('address')
  if (!address || !isValidAddress(address)) {
    return error('A valid Xeris wallet address is required.')
  }

  const record = await getVerification(address)
  if (!record) return json({ address, verified: false })

  const refereeAddresses = await listReferees(address)

  // Show each invitee's join time and testnet tier so a referrer can see their
  // invites landing. Addresses stay masked — being someone's referral should
  // not publish their full wallet to them.
  const store = verificationsStore()
  const referrals = await Promise.all(
    refereeAddresses.map(async (refereeAddress) => {
      const referee = await store.get(refereeAddress, { type: 'json' }).catch(() => null)
      return {
        address: maskAddress(refereeAddress),
        verifiedAt: referee?.verifiedAt ?? null,
        activity: referee?.onchain?.activity ?? 'new',
      }
    }),
  )

  referrals.sort((a, b) => (b.verifiedAt ?? 0) - (a.verifiedAt ?? 0))

  return json({
    address,
    verified: true,
    record: toPublicRecord(record, { referralCount: referrals.length }),
    referrals,
  })
}

export const config = { path: '/api/status' }
