import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Blocks, CheckCircle2, Clock, RefreshCw } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatTile } from '../components/ui/StatTile'
import { ActivityBadge } from '../components/ui/ActivityBadge'
import { ShareCard } from '../components/referral/ShareCard'
import { WalletGate } from '../components/wallet/WalletGate'
import { useWallet } from '../context/WalletContext'
import { useCampaign } from '../context/CampaignContext'
import { useToast } from '../context/ToastContext'
import { NETWORK_LABEL, TOKEN_SYMBOL } from '../lib/config'
import { formatDateTime, formatXrs, shortenAddress } from '../lib/encoding'
import './Dashboard.css'

export function Dashboard() {
  const { isConnected, hasWallet, isDetecting, connect, connecting } = useWallet()
  const { record, referrals, isVerified, loadingStatus, refreshStatus } = useCampaign()
  const toast = useToast()

  const handleConnect = async () => {
    try {
      await connect()
    } catch (err) {
      toast.error(err.message || 'Failed to connect wallet')
    }
  }

  // ── Not connected ───────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="page container dashboard-empty">
        <p className="eyebrow">Dashboard</p>
        <h1 className="section-title">Connect to see your status</h1>
        <p className="section-sub">
          Your verification, invite code and referral credit are tied to your wallet address.
        </p>

        <Card className="dashboard-gate static">
          {!hasWallet && !isDetecting ? (
            <WalletGate />
          ) : (
            <Button variant="accent" size="lg" onClick={handleConnect} disabled={connecting || isDetecting}>
              {isDetecting ? 'Looking for your wallet…' : connecting ? 'Connecting…' : 'Connect wallet'}
            </Button>
          )}
        </Card>
      </div>
    )
  }

  // ── Connected but not verified ──────────────────────────────────────────
  if (!isVerified) {
    return (
      <div className="page container dashboard-empty">
        <p className="eyebrow">Dashboard</p>
        <h1 className="section-title">
          {loadingStatus ? 'Checking your status…' : 'This wallet is not verified yet'}
        </h1>
        <p className="section-sub">
          Verify to lock in eligibility for the {TOKEN_SYMBOL} mainnet airdrop and unlock your
          invite code.
        </p>
        <Link to="/">
          <Button variant="accent" size="lg" className="dashboard-cta">
            Verify now <ArrowRight size={16} />
          </Button>
        </Link>
      </div>
    )
  }

  // ── Verified ────────────────────────────────────────────────────────────
  const { onchain } = record

  return (
    <motion.div
      className="page container dashboard"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <header className="dashboard-head">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="dashboard-title">
            <CheckCircle2 size={22} className="dashboard-check" />
            Verified
          </h1>
          <p className="dashboard-address mono">{shortenAddress(record.address, 10, 8)}</p>
        </div>

        <button className="dashboard-refresh" onClick={refreshStatus} disabled={loadingStatus}>
          <RefreshCw size={13} className={loadingStatus ? 'spin' : ''} />
          Refresh
        </button>
      </header>

      <div className="dashboard-stats">
        <StatTile label="Referrals" value={record.referralCount ?? referrals.length} />
        <StatTile
          label="Testnet balance"
          value={formatXrs(onchain.balanceLamports)}
          hint={TOKEN_SYMBOL}
        />
        <StatTile label="Verified at block" value={onchain.blockHeight ?? '—'} />
      </div>

      <div className="dashboard-grid">
        <ShareCard code={record.inviteCode} referralCount={record.referralCount ?? referrals.length} />

        <div className="dashboard-side">
          <Card className="static">
            <p className="eyebrow">Your record</p>
            <dl className="record-list">
              <div>
                <dt>Network</dt>
                <dd className="mono">{record.network}</dd>
              </div>
              <div>
                <dt>Verified</dt>
                <dd>{formatDateTime(record.verifiedAt)}</dd>
              </div>
              <div>
                <dt>Testnet activity</dt>
                <dd>
                  <ActivityBadge tier={onchain.activity} />
                </dd>
              </div>
              <div>
                <dt>Account on node</dt>
                <dd>{onchain.accountFound ? 'Found' : 'Not seen yet'}</dd>
              </div>
              {record.referredByCode && (
                <div>
                  <dt>Invited by</dt>
                  <dd className="mono">
                    {record.referredByAddress} · {record.referredByCode}
                  </dd>
                </div>
              )}
            </dl>

            <p className="record-note">
              <Blocks size={13} /> Anchored against {NETWORK_LABEL} at block{' '}
              {onchain.blockHeight ?? '—'}, checked {formatDateTime(onchain.checkedAt)}.
            </p>
          </Card>

          <Card className="static">
            <p className="eyebrow">Your invites</p>
            {referrals.length === 0 ? (
              <p className="referral-empty">
                No one has used your code yet. Share it and they will show up here as they verify.
              </p>
            ) : (
              <ul className="referral-list">
                {referrals.map((referral) => (
                  <li key={`${referral.address}-${referral.verifiedAt}`}>
                    <span className="mono referral-address">{referral.address}</span>
                    <span className="referral-meta">
                      <ActivityBadge tier={referral.activity} />
                      <span className="referral-time">
                        <Clock size={11} /> {formatDateTime(referral.verifiedAt)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </motion.div>
  )
}
