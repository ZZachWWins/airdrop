import './ActivityBadge.css'

/**
 * The testnet activity tier recorded on a verification.
 * `new` is not a failure state — it just means the wallet had no balance and
 * no sent transactions at the moment it was checked.
 */
const TIERS = {
  new: { label: 'New wallet', title: 'Verified, no testnet balance or transactions yet' },
  funded: { label: 'Funded', title: 'Holds a testnet XRS balance' },
  active: { label: 'Active', title: 'Has sent transactions on testnet' },
}

export const ActivityBadge = ({ tier = 'new' }) => {
  const meta = TIERS[tier] ?? TIERS.new
  return (
    <span className={`activity-badge tier-${tier}`} title={meta.title}>
      {meta.label}
    </span>
  )
}
