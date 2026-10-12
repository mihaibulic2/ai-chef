import { describe, expect, it } from 'vitest'
import { swapsForStep, unanchoredSwaps } from './cook'

type AnySwap = { id: string; title: string; change: string; stepKey: string | null; payoff: string }

function swap(id: string, stepKey: string | null): AnySwap {
  return { id, title: `title-${id}`, change: `change-${id}`, stepKey, payoff: `payoff-${id}` }
}

const steps = [{ key: 'boil-water' }, { key: 'cook-pasta' }, { key: 'serve' }] as never[]

const swaps = [
  swap('s1', 'cook-pasta'),
  swap('s2', null),
  swap('s3', 'boil-water'),
  swap('s4', 'cook-pasta'),
  swap('s5', 'missing-step'),
]

const plan = { steps, swaps } as unknown as Parameters<typeof unanchoredSwaps>[0] & Parameters<typeof swapsForStep>[0]

describe('swapsForStep', () => {
  it('returns only swaps anchored to the given step, in plan order', () => {
    expect(swapsForStep(plan, 'cook-pasta').map((s) => s.id)).toEqual(['s1', 's4'])
    expect(swapsForStep(plan, 'boil-water').map((s) => s.id)).toEqual(['s3'])
  })

  it('returns [] for a step with no swaps', () => {
    expect(swapsForStep(plan, 'serve')).toEqual([])
  })

  it('does not return null-keyed swaps for any step', () => {
    for (const key of ['boil-water', 'cook-pasta', 'serve', 'missing-step']) {
      expect(swapsForStep(plan, key).some((s) => s.id === 's2')).toBe(false)
    }
  })

  it('tolerates plan.swaps being undefined', () => {
    expect(swapsForStep({ swaps: undefined } as never, 'cook-pasta')).toEqual([])
  })
})

describe('unanchoredSwaps', () => {
  it('returns swaps with a null stepKey or a stepKey not in plan.steps, in plan order', () => {
    expect(unanchoredSwaps(plan).map((s) => s.id)).toEqual(['s2', 's5'])
  })

  it('returns [] when every swap is anchored to an existing step', () => {
    const anchored = { steps, swaps: [swap('a', 'boil-water'), swap('b', 'serve')] } as unknown as typeof plan
    expect(unanchoredSwaps(anchored)).toEqual([])
  })

  it('treats every swap as unanchored when the plan has no steps', () => {
    const noSteps = { steps: [], swaps: [swap('a', 'boil-water'), swap('b', null)] } as unknown as typeof plan
    expect(unanchoredSwaps(noSteps).map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('tolerates plan.swaps being undefined', () => {
    expect(unanchoredSwaps({ steps, swaps: undefined } as never)).toEqual([])
  })
})
