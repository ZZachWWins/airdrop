import './Card.css'

export const Card = ({
  children,
  className = '',
  withBeam = false,
  withScan = false,
  onClick,
}) => (
  <div className={`enterprise-card ${className}`} onClick={onClick}>
    <div className="card-gradient-top" />
    {withBeam && <div className="card-beam" />}
    {withScan && <div className="card-scan-line" />}
    <div className="card-content">{children}</div>
  </div>
)
