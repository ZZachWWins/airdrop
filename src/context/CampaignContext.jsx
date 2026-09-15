import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useWallet } from './WalletContext'
import { ApiError, fetchStatus, requestChallenge, submitVerification } from '../lib/api'
import { bytesToBase64 } from '../lib/encoding'
import { clearStoredCode, readCodeFromLocation, readStoredCode, storeCode } from '../lib/referral'

/**
 * Campaign state: the connected wallet's verification record, the pending
 * invite code, and the verify action itself.
 */

const CampaignContext = createContext(null)

/** Verification is a short state machine; the UI renders straight off it. */
export const STEP = {
  IDLE: 'idle',
  CHALLENGING: 'challenging',
  SIGNING: 'signing',
  SUBMITTING: 'submitting',
  DONE: 'done',
}

function CampaignState({ children }) {
  const { address, signMessage } = useWallet()
  const location = useLocation()

  const [record, setRecord] = useState(null)
  const [referrals, setReferrals] = useState([])
  const [loadingStatus, setLoadingStatus] = useState(Boolean(address))
  const [step, setStep] = useState(STEP.IDLE)
  const [verifyError, setVerifyError] = useState(null)

  // ── Invite code ─────────────────────────────────────────────────────────
  // Derived rather than stored, so a code arriving in the URL needs no effect
  // to become visible. `manualCode` covers the typed-in and previously-stored
  // cases; `dismissedCode` lets the user drop one that came from the URL.
  const [manualCode, setManualCode] = useState(() => readStoredCode())
  const [dismissedCode, setDismissedCode] = useState(null)

  const urlCode = readCodeFromLocation(location.search, location.pathname)
  const candidateCode = urlCode ?? manualCode
  const inviteCode = !record && candidateCode !== dismissedCode ? candidateCode : null

  // Persist a URL code so it survives the hop out to the Xeris Web4 browser.
  // Writing to storage is not React state, so it belongs in an effect.
  useEffect(() => {
    if (urlCode) storeCode(urlCode)
  }, [urlCode])

  // Once verified, the code that brought you here has done its job.
  useEffect(() => {
    if (record) clearStoredCode()
  }, [record])

  const applyInviteCode = useCallback((code) => {
    const stored = storeCode(code)
    if (stored) {
      setManualCode(stored)
      setDismissedCode(null)
    }
    return stored
  }, [])

  const dropInviteCode = useCallback(() => {
    clearStoredCode()
    setDismissedCode(candidateCode)
    setManualCode(null)
  }, [candidateCode])

  // ── Status ──────────────────────────────────────────────────────────────

  const refreshStatus = useCallback(async () => {
    if (!address) return null

    setLoadingStatus(true)
    try {
      const data = await fetchStatus(address)
      setRecord(data.verified ? data.record : null)
      setReferrals(data.referrals ?? [])
      return data
    } catch {
      // A failed status read leaves the previous view in place rather than
      // wrongly telling someone they are unverified.
      return null
    } finally {
      setLoadingStatus(false)
    }
  }, [address])

  // This component is keyed on the address by CampaignProvider, so it remounts
  // whenever the wallet changes — there is no stale state to reset here.
  useEffect(() => {
    if (!address) return undefined

    let cancelled = false
    fetchStatus(address)
      .then((data) => {
        if (cancelled) return
        setRecord(data.verified ? data.record : null)
        setReferrals(data.referrals ?? [])
      })
      .catch(() => {
        // Leave the panel in its unverified state; the user can still verify,
        // and /api/verify is idempotent if they already had.
      })
      .finally(() => {
        if (!cancelled) setLoadingStatus(false)
      })

    return () => {
      cancelled = true
    }
  }, [address])

  /**
   * Run the full verification: challenge -> wallet signature -> submit.
   *
   * An unusable invite code is reported without wiping progress — the user can
   * clear it and re-run, which costs one more signature but never blocks
   * verification itself.
   */
  const verify = useCallback(
    async ({ withCode = true } = {}) => {
      if (!address) throw new Error('Connect your wallet first.')

      setVerifyError(null)
      const codeToSend = withCode ? inviteCode : null

      try {
        setStep(STEP.CHALLENGING)
        const { nonce, message } = await requestChallenge(address)

        setStep(STEP.SIGNING)
        const signatureBytes = await signMessage(message)

        setStep(STEP.SUBMITTING)
        const { record: verified } = await submitVerification({
          address,
          nonce,
          signature: bytesToBase64(signatureBytes),
          inviteCode: codeToSend,
        })

        setRecord(verified)
        setStep(STEP.DONE)
        await refreshStatus()
        return verified
      } catch (err) {
        setStep(STEP.IDLE)

        const badCode =
          err instanceof ApiError &&
          ['invalid_code', 'unknown_code', 'self_referral'].includes(err.reason)

        setVerifyError({
          message:
            err?.message ||
            (err instanceof ApiError
              ? 'Verification failed.'
              : 'Your wallet declined the signature.'),
          reason: err instanceof ApiError ? err.reason : 'wallet_rejected',
          recoverableByDroppingCode: badCode,
        })
        throw err
      }
    },
    [address, inviteCode, signMessage, refreshStatus],
  )

  const value = useMemo(
    () => ({
      record,
      referrals,
      isVerified: Boolean(record),
      loadingStatus,
      step,
      isBusy: step !== STEP.IDLE && step !== STEP.DONE,
      verifyError,
      inviteCode,
      applyInviteCode,
      dropInviteCode,
      verify,
      refreshStatus,
    }),
    [
      record,
      referrals,
      loadingStatus,
      step,
      verifyError,
      inviteCode,
      applyInviteCode,
      dropInviteCode,
      verify,
      refreshStatus,
    ],
  )

  return <CampaignContext.Provider value={value}>{children}</CampaignContext.Provider>
}

/**
 * Keying the state on the connected address makes every wallet switch — and
 * every disconnect — a clean remount. Nothing from the previous account can
 * survive into the next one, which is exactly the guarantee you want when the
 * state on screen is "are you eligible for an airdrop".
 */
export function CampaignProvider({ children }) {
  const { address } = useWallet()
  return <CampaignState key={address ?? 'disconnected'}>{children}</CampaignState>
}

export function useCampaign() {
  const ctx = useContext(CampaignContext)
  if (!ctx) throw new Error('useCampaign must be used inside a CampaignProvider')
  return ctx
}
