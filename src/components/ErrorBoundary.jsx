import { Component } from 'react'

/**
 * Keeps a render error in one route from blanking the whole app — which on a
 * phone just looks like the site is broken.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error('Unhandled render error:', error)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="page container" style={{ maxWidth: '560px' }}>
        <p className="eyebrow">Something broke</p>
        <h1 className="section-title">This page failed to render</h1>
        <p className="section-sub">
          Your verification status is stored against your wallet address, so nothing is lost.
          Reload the page to try again.
        </p>
        <button
          className="btn btn-accent btn-lg"
          style={{ marginTop: '2rem' }}
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    )
  }
}
