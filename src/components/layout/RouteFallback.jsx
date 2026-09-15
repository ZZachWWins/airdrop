import './RouteFallback.css'

/**
 * Shown while a lazily-loaded route arrives. Deliberately quiet: a spinner
 * that flashes for 80ms on a fast connection reads as jank, so this is a
 * low-contrast pulse that only becomes noticeable if the wait is real.
 */
export const RouteFallback = () => (
  <div className="route-fallback" role="status" aria-label="Loading">
    <span className="route-fallback-bar" />
  </div>
)
