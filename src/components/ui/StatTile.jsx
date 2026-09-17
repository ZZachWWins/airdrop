import { useCountUp } from '../../hooks/useCountUp'
import './StatTile.css'

/**
 * `count` animates the figure up on arrival. Pass it for headline numbers;
 * leave it off for static facts like a block height, where a climbing
 * counter would imply movement that is not happening.
 */
export const StatTile = ({ label, value, hint, loading = false, count = false }) => (
  <div className="stat-tile">
    <p className="stat-label">{label}</p>
    <p className="stat-value">
      {loading ? <span className="stat-skeleton" /> : count ? <Counted value={value} /> : value}
    </p>
    {hint && <p className="stat-hint">{hint}</p>}
  </div>
)

function Counted({ value }) {
  return useCountUp(value).toLocaleString()
}
