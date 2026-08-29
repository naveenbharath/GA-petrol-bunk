import { useEffect, useState } from 'react'

export default function useSimulatedLoading(ms = 600, deps = []) {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => setLoading(false), ms)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return loading
}
