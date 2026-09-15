import './StatTile.css'

export const StatTile = ({ label, value, hint, loading = false }) => (
  <div className="stat-tile">
    <p className="stat-label">{label}</p>
    <p className="stat-value">{loading ? <span className="stat-skeleton" /> : value}</p>
    {hint && <p className="stat-hint">{hint}</p>}
  </div>
)
