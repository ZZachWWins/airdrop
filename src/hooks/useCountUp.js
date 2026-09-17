import { useEffect, useRef, useState } from 'react'

const DURATION_MS = 1100

/**
 * Animate a number up to its value.
 *
 * Counters that snap into place read as static data; counters that climb read
 * as something happening. Only worth it for the headline figures — it is
 * energy, not decoration, and using it everywhere would spend the effect.
 *
 * Honours prefers-reduced-motion by landing on the value immediately.
 */
export function useCountUp(value) {
  const target = Number(value) || 0
  const [display, setDisplay] = useState(target)
  const fromRef = useRef(target)
  const frameRef = useRef(0)

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    const from = fromRef.current
    if (reduced || from === target) {
      fromRef.current = target
      setDisplay(target)
      return undefined
    }

    const start = performance.now()
    const tick = (now) => {
      const progress = Math.min((now - start) / DURATION_MS, 1)
      // easeOutExpo: fast out of the gate, settles softly on the number.
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      setDisplay(Math.round(from + (target - from) * eased))

      if (progress < 1) frameRef.current = requestAnimationFrame(tick)
      else fromRef.current = target
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target])

  return display
}
