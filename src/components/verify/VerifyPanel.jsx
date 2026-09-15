import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, ArrowRight, BadgeCheck, Loader2, PenLine, ShieldCheck } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { WalletGate } from '../wallet/WalletGate'
import { InviteBanner } from './InviteBanner'
import { CodeEntry } from './CodeEntry'
import { useWallet } from '../../context/WalletContext'
import { STEP, useCampaign } from '../../context/CampaignContext'
import { useToast } from '../../context/ToastContext'
import { NETWORK_LABEL, TOKEN_SYMBOL } from '../../lib/config'
import { formatDate, shortenAddress } from '../../lib/encoding'
import './VerifyPanel.css'

const STEP_COPY = {
  [STEP.CHALLENGING]: 'Requesting a challenge…',
  [STEP.SIGNING]: 'Check your wallet — approve the signature',
  [STEP.SUBMITTING]: 'Recording your verification…',
}

export function VerifyPanel() {
  const { isConnected, hasWallet, isDetecting, connect, connecting, address } = useWallet()
  const { isVerified, record, loadingStatus, step, isBusy, verifyError, inviteCode, verify } =
    useCampaign()
  const toast = useToast()

  const runVerify = async (options) => {
    try {
      await verify(options)
      toast.success(`Verified on ${NETWORK_LABEL}. Your invite code is ready.`)
    } catch {
      // The panel renders verifyError inline; a toast as well would double up.
    }
  }

  const handleConnect = async () => {
    try {
      await connect()
    } catch (err) {
      toast.error(err.message || 'Failed to connect wallet')
    }
  }

  // ── Already verified ────────────────────────────────────────────────────
  if (isVerified && record) {
    return (
      <Card className="verify-panel static" withScan>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="verify-status verified">
            <BadgeCheck size={18} />
            <span>Verified on {NETWORK_LABEL}</span>
          </div>

          <h3 className="verify-title">You are on the list</h3>
          <p className="verify-copy">
            Your wallet signed a testnet challenge on {formatDate(record.verifiedAt)} and the
            record is anchored at block {record.onchain.blockHeight ?? '—'}. When {TOKEN_SYMBOL}{' '}
            launches on mainnet, this address is eligible to claim.
          </p>

          <dl className="verify-facts">
            <div>
              <dt>Address</dt>
              <dd className="mono">{shortenAddress(record.address, 8, 6)}</dd>
            </div>
            <div>
              <dt>Invite code</dt>
              <dd className="mono accent">{record.inviteCode}</dd>
            </div>
          </dl>

          <Link to="/dashboard">
            <Button variant="accent" size="lg" className="btn-block">
              Open dashboard <ArrowRight size={16} />
            </Button>
          </Link>
        </motion.div>
      </Card>
    )
  }

  // ── No wallet injected ──────────────────────────────────────────────────
  // The invite banner comes along: someone who followed an invite link in
  // Safari or Chrome should see their invite acknowledged before being asked
  // to go and open the page somewhere else.
  if (!hasWallet && !isDetecting) {
    return (
      <Card className="verify-panel static">
        {inviteCode && <InviteBanner key={inviteCode} code={inviteCode} />}
        <WalletGate />
      </Card>
    )
  }

  // ── Detecting / connecting / signing ────────────────────────────────────
  return (
    <Card className="verify-panel static" withScan={!isBusy}>
      <div className="verify-status">
        <ShieldCheck size={18} />
        <span>Step {isConnected ? '2' : '1'} of 2</span>
      </div>

      <h3 className="verify-title">
        {isConnected ? 'Sign to verify your testnet wallet' : 'Connect your Xeris wallet'}
      </h3>

      <p className="verify-copy">
        {isConnected
          ? `Approve one signature and your address is recorded as an active ${NETWORK_LABEL} participant. No gas, no transaction, nothing leaves your wallet.`
          : `Verification takes two taps. Connect the wallet you use on ${NETWORK_LABEL}, then approve a single signature.`}
      </p>

      {inviteCode ? <InviteBanner key={inviteCode} code={inviteCode} /> : <CodeEntry />}

      {isConnected && (
        <p className="verify-address mono">
          {shortenAddress(address, 10, 8)}
          {loadingStatus && <span className="verify-checking"> · checking status…</span>}
        </p>
      )}

      {verifyError && (
        <div className="verify-error" role="alert">
          <AlertTriangle size={15} />
          <div>
            <p>{verifyError.message}</p>
            {verifyError.recoverableByDroppingCode && (
              <button className="verify-error-action" onClick={() => runVerify({ withCode: false })}>
                Verify without an invite code
              </button>
            )}
          </div>
        </div>
      )}

      {isBusy ? (
        <div className="verify-progress">
          <Loader2 size={16} className="spin" />
          <span>{STEP_COPY[step] ?? 'Working…'}</span>
        </div>
      ) : (
        <Button
          variant="accent"
          size="lg"
          className="btn-block"
          onClick={isConnected ? () => runVerify() : handleConnect}
          disabled={connecting || isDetecting || loadingStatus}
        >
          {isDetecting ? (
            'Looking for your wallet…'
          ) : isConnected ? (
            <>
              <PenLine size={16} /> Sign &amp; verify
            </>
          ) : connecting ? (
            'Connecting…'
          ) : (
            'Connect wallet'
          )}
        </Button>
      )}

      <p className="verify-fineprint">
        Signing proves you hold the key. It cannot move funds or approve a transaction.
      </p>
    </Card>
  )
}
