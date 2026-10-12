import type { Swap } from '../ai/types'
import { applySwap } from '../state/actions'

/** A healthier substitution offered on the ingredients page ("Switch to this") or at its step ("I did this"). */
export function SwapCard({ swap, done, mode }: { swap: Swap; done: boolean; mode: 'shop' | 'step' }) {
  return (
    <div className={`card swap${done ? ' done' : ''}`} data-testid={`swap-${swap.id}`}>
      <div className="eyebrow">{done ? 'Swapped ✓' : 'Pro tip'}</div>
      <div className="swap-title">{swap.title}</div>
      <div className="swap-change">{swap.change}</div>
      <div className="swap-payoff">{swap.payoff}</div>
      {!done && (
        <button className="btn small green" onClick={() => void applySwap(swap.id)} data-testid={`swap-apply-${swap.id}`}>
          {mode === 'shop' ? 'Switch to this' : 'I did this'}
        </button>
      )}
    </div>
  )
}
