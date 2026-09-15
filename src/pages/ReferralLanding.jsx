import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { normaliseCode } from '../lib/inviteCode'
import { storeCode } from '../lib/referral'

/**
 * `/r/:code` — the shareable invite link.
 *
 * Its whole job is to bank the code and get out of the way.
 *
 * The redirect keeps the code in the URL as `?ref=`, which matters more than
 * it looks: localStorage does not travel from Safari or Chrome into the Xeris
 * Web4 in-app browser, so the URL the visitor copies across has to carry the
 * referral itself. Storage only covers reloads within the same browser.
 *
 * The code is persisted from a `useState` initialiser rather than an effect:
 * `<Navigate>` is a child, and child effects flush before this component's
 * would, so an effect here races the redirect.
 */
export function ReferralLanding() {
  const { code } = useParams()
  const [normalised] = useState(() => storeCode(normaliseCode(code)))

  return <Navigate to={normalised ? `/?ref=${normalised}` : '/'} replace />
}
