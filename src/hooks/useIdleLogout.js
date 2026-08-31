import { useEffect, useRef } from 'react'

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'wheel']
// Coarse polling instead of resetting a timeout on every event — a moving
// mouse fires dozens of events/sec, and churning through that many
// clearTimeout/setTimeout calls for a multi-hour window is wasted work.
const CHECK_INTERVAL_MS = 30_000

// Fires `onIdle` once after `timeoutMs` of no user activity (mouse, keyboard,
// touch, scroll) anywhere in the document, or after the tab was hidden for
// that long. Re-arms automatically if the caller's effect remounts (e.g.
// after a fresh login), since firedRef/lastActivityRef reset with it.
export default function useIdleLogout(timeoutMs, onIdle) {
  const lastActivityRef = useRef(Date.now())
  const firedRef = useRef(false)
  const onIdleRef = useRef(onIdle)
  onIdleRef.current = onIdle

  useEffect(() => {
    function markActive() {
      lastActivityRef.current = Date.now()
      firedRef.current = false
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') markActive()
    }

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, markActive, { passive: true }))
    document.addEventListener('visibilitychange', handleVisibility)

    const intervalId = setInterval(() => {
      if (firedRef.current) return
      if (Date.now() - lastActivityRef.current >= timeoutMs) {
        firedRef.current = true
        onIdleRef.current()
      }
    }, CHECK_INTERVAL_MS)

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, markActive))
      document.removeEventListener('visibilitychange', handleVisibility)
      clearInterval(intervalId)
    }
  }, [timeoutMs])
}
