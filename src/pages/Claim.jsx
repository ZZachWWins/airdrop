import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, BadgeCheck, Loader2, Lock, PenLine } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { WalletGate } from '../components/wallet/WalletGate'
import { useWallet } from '../context/WalletContext'
import { useToast } from '../context/ToastContext'
import { CLAIM_STEP, useClaim } from '../hooks/useClaim'
import { isValidAddress } from '../lib/address'
import { formatDateTime, shortenAddress } from '../lib/encoding'
import { NETWORK_LABEL, TOKEN_SYMBOL } from '../lib/config'
import './Claim.css'

const STEP_COPY = {
  [CLAIM_STEP.CHALLENGING]: 'Preparing your authorisation…',
  [CLAIM_STEP.SIGNING]: 'Check your wallet — approve the payout authorisation',
  [CLAIM_STEP.SUBMITTING]: 'Recording your claim…',
}

/**
 * Gate on the wallet before mounting the claim state. Keying on the address
 * means switching wallets in Xeris Web4 remounts the flow rather than leaving
 * the previous wallet's claim on screen — which on this page would show one
 * wallet's payout address above another wallet's sign button.
 */
export function Claim() {
  const { isConnected, hasWallet, isDetecting, connect, connecting, address } = useWallet()
  const toast = useToast()

  const handleConnect = async () => {
    try {
      await connect()
    } catch (err) {
      toast.error(err.message || 'Failed to connect wallet')
    }
  }

  if (!isConnected) {
    return (
      <div className="page container claim-narrow">
        <p className="eyebrow">Mainnet claim</p>
        <h1 className="section-title">Connect your testnet wallet</h1>
        <p className="section-sub">
          Claim with the same {NETWORK_LABEL} wallet you verified with. It is the key that proves
          the claim is yours — you will tell us where to pay on the next screen.
        </p>

        <Card className="claim-gate static">
          {!hasWallet && !isDetecting ? (
            <WalletGate />
          ) : (
            <Button
              variant="accent"
              size="lg"
              onClick={handleConnect}
              disabled={connecting || isDetecting}
            >
              {isDetecting
                ? 'Looking for your wallet…'
                : connecting
                  ? 'Connecting…'
                  : 'Connect testnet wallet'}
            </Button>
          )}
        </Card>
      </div>
    )
  }

  return <ClaimFlow key={address} address={address} />
}

function ClaimFlow({ address }) {
  const { status, loading, step, isBusy, error, claim } = useClaim()
  const toast = useToast()

  const [input, setInput] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const trimmed = input.trim()
  const looksValid = isValidAddress(trimmed)
  const isSameAsTestnet = trimmed === address

  const handleClaim = async () => {
    try {
      await claim(trimmed)
      toast.success('Claim recorded. Your mainnet address is locked in.')
      setInput('')
      setConfirmed(false)
    } catch {
      // Rendered inline below; a toast as well would double up.
    }
  }

  if (loading) {
    return (
      <div className="page container claim-narrow">
        <p className="eyebrow">Mainnet claim</p>
        <h1 className="section-title">Checking your eligibility…</h1>
      </div>
    )
  }

  // ── Window not open ─────────────────────────────────────────────────────
  // The endpoints refuse a claim until CLAIM_PHASE=open, so without this the
  // page would invite someone to type a payout address and sign for it, then
  // fail at the last step. Nothing is collected before the window opens.
  if (status && status.phase !== 'open') {
    return (
      <div className="page container claim-narrow">
        <p className="eyebrow">Mainnet claim</p>
        <h1 className="section-title">Claiming is not open yet</h1>
        <p className="section-sub">
          {status.eligible
            ? `Your testnet wallet is verified and on the list. When ${TOKEN_SYMBOL} launches on mainnet, come back here to enter your mainnet address and claim.`
            : `This wallet is not in the testnet registry. Verify it first — claiming opens when ${TOKEN_SYMBOL} launches on mainnet.`}
        </p>

        <Card className="claim-result static">
          <div className="claim-status">
            <Lock size={18} />
            <span>Opens at mainnet launch</span>
          </div>
          <p className="claim-closed-note">
            Keep your {NETWORK_LABEL} wallet and its recovery phrase safe. That key is the only
            thing that can claim this allocation — there is no recovery if it is lost.
          </p>
        </Card>

        <Link to={status.eligible ? '/dashboard' : '/'}>
          <Button variant="secondary" size="lg" className="claim-cta">
            {status.eligible ? 'Back to dashboard' : 'Verify this wallet'}
          </Button>
        </Link>
      </div>
    )
  }

  // ── Not eligible ────────────────────────────────────────────────────────
  if (status && !status.eligible) {
    return (
      <div className="page container claim-narrow">
        <p className="eyebrow">Mainnet claim</p>
        <h1 className="section-title">This wallet did not verify</h1>
        <p className="section-sub">
          <span className="mono">{shortenAddress(address, 8, 6)}</span> is not in the testnet
          registry, so there is nothing to claim against it. If you verified with a different
          wallet, switch to it in Xeris Web4 and come back.
        </p>
        <Link to="/">
          <Button variant="secondary" size="lg" className="claim-cta">
            Back to verification
          </Button>
        </Link>
      </div>
    )
  }

  // ── Already claimed ─────────────────────────────────────────────────────
  const existing = status?.claim
  if (existing && !isBusy) {
    return (
      <div className="page container claim-narrow">
        <p className="eyebrow">Mainnet claim</p>
        <h1 className="section-title">
          {existing.status === 'paid' ? 'Paid out' : 'Claim recorded'}
        </h1>
        <p className="section-sub">
          {existing.status === 'paid'
            ? `Your ${TOKEN_SYMBOL} has been sent to the address below.`
            : `Your payout address is locked in. ${TOKEN_SYMBOL} will be sent there when the distribution runs.`}
        </p>

        <Card className="claim-result static" withScan={existing.status !== 'paid'}>
          <div className={`claim-status ${existing.status}`}>
            {existing.status === 'paid' ? <BadgeCheck size={18} /> : <Lock size={18} />}
            <span>{existing.status === 'paid' ? 'Paid' : 'Awaiting distribution'}</span>
          </div>

          <dl className="claim-facts">
            <div>
              <dt>Paying to (mainnet)</dt>
              <dd className="mono accent">{existing.mainnetAddress}</dd>
            </div>
            <div>
              <dt>Testnet wallet</dt>
              <dd className="mono">{shortenAddress(existing.testnetAddress, 8, 6)}</dd>
            </div>
            <div>
              <dt>Claimed</dt>
              <dd>{formatDateTime(existing.claimedAt)}</dd>
            </div>
            {existing.payoutTxId && (
              <div>
                <dt>Payout tx</dt>
                <dd className="mono">{existing.payoutTxId}</dd>
              </div>
            )}
          </dl>

          {existing.status !== 'paid' && (
            <p className="claim-rebind">
              Wrong address? You can re-sign with a different one until the distribution runs —
              scroll down and submit again.
            </p>
          )}
        </Card>

        {existing.status !== 'paid' && <ClaimForm {...{ input, setInput, trimmed, looksValid, isSameAsTestnet, confirmed, setConfirmed, error, step, isBusy, handleClaim }} rebinding />}
      </div>
    )
  }

  // ── Claim form ──────────────────────────────────────────────────────────
  return (
    <div className="page container claim-narrow">
      <p className="eyebrow">Mainnet claim</p>
      <h1 className="section-title">Where should we send your {TOKEN_SYMBOL}?</h1>
      <p className="section-sub">
        You verified <span className="mono">{shortenAddress(address, 6, 4)}</span> on{' '}
        {NETWORK_LABEL}
        {status?.verifiedAt ? ` on ${formatDateTime(status.verifiedAt)}` : ''}. Your mainnet wallet
        is a different keypair, so tell us its address and sign with your testnet key to authorise
        the payout.
      </p>

      <ClaimForm {...{ input, setInput, trimmed, looksValid, isSameAsTestnet, confirmed, setConfirmed, error, step, isBusy, handleClaim }} />
    </div>
  )
}

function ClaimForm({
  input,
  setInput,
  trimmed,
  looksValid,
  isSameAsTestnet,
  confirmed,
  setConfirmed,
  error,
  step,
  isBusy,
  handleClaim,
  rebinding = false,
}) {
  const showFormatError = trimmed.length > 0 && !looksValid
  const canSubmit = looksValid && !isSameAsTestnet && confirmed && !isBusy

  return (
    <Card className="claim-card static">
      <label htmlFor="mainnet-address" className="claim-label">
        {rebinding ? 'New mainnet address' : 'Your mainnet address'}
      </label>
      <textarea
        id="mainnet-address"
        className="claim-input mono"
        value={input}
        onChange={(event) => {
          setInput(event.target.value)
          setConfirmed(false)
        }}
        placeholder="Paste your Xeris mainnet wallet address"
        rows={2}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck="false"
      />

      {showFormatError && (
        <p className="claim-inline-error">
          That is not a valid Xeris address. Paste it again — do not retype it by hand.
        </p>
      )}
      {isSameAsTestnet && (
        <p className="claim-inline-error">
          That is your testnet address. Paste the mainnet wallet you want to be paid at.
        </p>
      )}

      <div className="claim-warning">
        <AlertTriangle size={16} />
        <p>
          Tokens sent to the wrong address cannot be recovered. Check every character of the
          address above against your mainnet wallet before you sign.
        </p>
      </div>

      <label className="claim-confirm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          disabled={!looksValid || isSameAsTestnet}
        />
        <span>I have checked this address and it is my Xeris mainnet wallet.</span>
      </label>

      {error && (
        <div className="claim-error" role="alert">
          <AlertTriangle size={15} />
          <p>{error.message}</p>
        </div>
      )}

      {isBusy ? (
        <div className="claim-progress">
          <Loader2 size={16} className="spin" />
          <span>{STEP_COPY[step] ?? 'Working…'}</span>
        </div>
      ) : (
        <Button
          variant="accent"
          size="lg"
          className="btn-block"
          onClick={handleClaim}
          disabled={!canSubmit}
        >
          <PenLine size={16} />
          {rebinding ? 'Sign & update payout address' : 'Sign & claim'}
          <ArrowRight size={16} />
        </Button>
      )}

      <p className="claim-fineprint">
        Signing authorises the payout address. It moves nothing from your testnet wallet and costs
        no gas.
      </p>
    </Card>
  )
}
