import { useEffect, useReducer } from 'react'
import { busy } from '../state/actions'

/** Re-render when in-flight AI work starts or finishes. */
export function useBusy(): void {
  const [, bump] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    busy.listeners.add(bump)
    return () => { busy.listeners.delete(bump) }
  }, [])
}
