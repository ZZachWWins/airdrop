import { useCallback, useEffect, useState } from 'react'
import { useWallet } from '../context/WalletContext'
import { fetchClaimStatus, requestClaimChallenge, submitClaim } from '../lib/api'
import { bytesToBase64 } from '../lib/encoding'

/** The claim is a short state machine, same shape as verification. */
export const CLAIM_STEP = {
  IDLE: 'idle',
  CHALLENGING: 'challenging',
  SIGNING: 'signing',
  SUBMITTING: 'submitting',
  DONE: 'done',
}

/**
 * Mainnet claim state for the connected testnet wallet.
 *
 * The two-call shape matters: the payout address is sent on the *challenge*
 * call so the server can bake it into the signed text, and the claim call
 * carries only the signature. `pendingMessage` holds the exact text that came
 * back, so the UI can show the user what they are about to approve before the
 * wallet prompt opens.
 *
 * Only call this from a component that is mounted when a wallet is connected
 * and keyed on the address — the caller in pages/Claim.jsx does both, which
 * is why there is no disconnect branch to reset here.
 */
export function useClaim() {
  const { address, signMessage } = useWallet()

  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(CLAIM_STEP.IDLE)
  const [error, setError] = useState(null)
  const [pendingMessage, setPendingMessage] = useState(null)

  const refresh = useCallback(async () => {
    if (!address) {
      setStatus(null)
      return null
    }
    setLoading(true)
    try {
      const data = await fetchClaimStatus(address)
      setStatus(data)
      return data
    } catch {
      return null
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    if (!address) return undefined

    let cancelled = false
    fetchClaimStatus(address)
      .then((data) => {
        if (!cancelled) setStatus(data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [address])

  const claim = useCallback(
    async (mainnetAddress) => {
      if (!address) throw new Error('Connect your testnet wallet first.')

      setError(null)
      try {
        setStep(CLAIM_STEP.CHALLENGING)
        const { nonce, message } = await requestClaimChallenge({ address, mainnetAddress })
        setPendingMessage(message)

        setStep(CLAIM_STEP.SIGNING)
        const signatureBytes = await signMessage(message)

        setStep(CLAIM_STEP.SUBMITTING)
        await submitClaim({ address, nonce, signature: bytesToBase64(signatureBytes) })

        setStep(CLAIM_STEP.DONE)
        setPendingMessage(null)
        await refresh()
      } catch (err) {
        setStep(CLAIM_STEP.IDLE)
        setPendingMessage(null)
        setError({
          message: err?.message || 'Your wallet declined the signature.',
          reason: err?.reason ?? 'wallet_rejected',
        })
        throw err
      }
    },
    [address, signMessage, refresh],
  )

  return {
    status,
    loading,
    step,
    isBusy: step !== CLAIM_STEP.IDLE && step !== CLAIM_STEP.DONE,
    error,
    pendingMessage,
    claim,
    refresh,
  }
}
