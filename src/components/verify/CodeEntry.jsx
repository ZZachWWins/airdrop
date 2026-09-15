import { useState } from 'react'
import { Check } from 'lucide-react'
import { useCampaign } from '../../context/CampaignContext'
import { normaliseCode } from '../../lib/inviteCode'
import './CodeEntry.css'

/**
 * Manual invite code entry, for a code that arrived by word of mouth rather
 * than through a link. Collapsed by default — most visitors arrive with the
 * code already captured from their invite URL and should not be asked for one.
 */
export function CodeEntry() {
  const { applyInviteCode } = useCampaign()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState(null)

  const submit = (event) => {
    event.preventDefault()
    const normalised = normaliseCode(value)
    if (!normalised) {
      setError('That does not look like a valid code.')
      return
    }
    setError(null)
    applyInviteCode(normalised)
    setValue('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button className="code-entry-toggle" onClick={() => setOpen(true)}>
        Have an invite code?
      </button>
    )
  }

  return (
    <form className="code-entry" onSubmit={submit}>
      <label htmlFor="invite-code" className="code-entry-label">
        Invite code
      </label>
      <div className="code-entry-row">
        <input
          id="invite-code"
          className="code-entry-input mono"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setError(null)
          }}
          placeholder="XRS-A1B2C3"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck="false"
          maxLength={16}
        />
        <button type="submit" className="code-entry-apply" aria-label="Apply invite code">
          <Check size={15} />
        </button>
      </div>
      {error && <p className="code-entry-error">{error}</p>}
    </form>
  )
}
