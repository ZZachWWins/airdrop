import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { ActivityBadge } from '../components/ui/ActivityBadge'
import { Button } from '../components/ui/Button'
import { fetchLeaderboard } from '../lib/api'
import { formatDate } from '../lib/encoding'
import './Leaderboard.css'

export function Leaderboard() {
  const [entries, setEntries] = useState([])
  const [state, setState] = useState('loading')

  useEffect(() => {
    let cancelled = false

    fetchLeaderboard(50)
      .then((data) => {
        if (cancelled) return
        setEntries(data.entries ?? [])
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="page container leaderboard">
      <p className="eyebrow">Leaderboard</p>
      <h1 className="section-title">Top inviters</h1>
      <p className="section-sub">
        Ranked by verified referrals. Addresses are masked — referral counts are public, wallets
        are not.
      </p>

      <Card className="leaderboard-card static">
        {state === 'loading' && <p className="leaderboard-note">Loading…</p>}

        {state === 'error' && (
          <p className="leaderboard-note">
            Could not load the leaderboard right now. Please try again shortly.
          </p>
        )}

        {state === 'ready' && entries.length === 0 && (
          <div className="leaderboard-empty">
            <Trophy size={28} />
            <p>No referrals recorded yet. Verify and share your code to take the top spot.</p>
            <Link to="/">
              <Button variant="accent">Verify your wallet</Button>
            </Link>
          </div>
        )}

        {state === 'ready' && entries.length > 0 && (
          <ol className="leaderboard-list">
            {entries.map((entry) => (
              <li key={entry.rank} className={entry.rank <= 3 ? 'podium' : ''}>
                <span className="lb-rank">{String(entry.rank).padStart(2, '0')}</span>
                <span className="lb-address mono">{entry.address}</span>
                <span className="lb-tier">
                  <ActivityBadge tier={entry.activity} />
                </span>
                <span className="lb-since">{formatDate(entry.verifiedAt)}</span>
                <span className="lb-count">
                  {entry.referralCount}
                  <small>invites</small>
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}
