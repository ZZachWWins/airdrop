import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { XerisMark } from '../components/ui/XerisMark'
import './NotFound.css'

export function NotFound() {
  return (
    <div className="page container not-found">
      <XerisMark size={64} className="not-found-mark" strokeWidth={44} />
      <p className="eyebrow">404</p>
      <h1 className="section-title">Nothing here</h1>
      <p className="section-sub">
        That page does not exist. If you followed an invite link, the code may have been mistyped —
        head to the verify page and enter it there.
      </p>
      <Link to="/">
        <Button variant="accent" size="lg" className="not-found-cta">
          Go to verification
        </Button>
      </Link>
    </div>
  )
}
