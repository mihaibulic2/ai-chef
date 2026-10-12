import { describe, expect, it } from 'vitest'
import { DOT_HUES, GREY_FLOOR, dotStyle } from './dotColor'

const alphaOf = (bg: string): number => {
  const m = bg.match(/rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*([\d.]+))?\s*\)/)
  if (!m) throw new Error(`not an rgb(a) colour: ${bg}`)
  return m[1] === undefined ? 1 : Number(m[1])
}

describe('dotStyle', () => {
  it('is grey with no shadow below the floor, for every verdict', () => {
    for (const v of ['good', 'neutral', 'bad'] as const) {
      const s = dotStyle(v, GREY_FLOOR / 2)
      expect(s.boxShadow).toBe('none')
      expect(s.background).toMatch(/^rgba\(/)
      expect(s.background).not.toContain(DOT_HUES[v])
    }
  })

  it('all verdicts share the same grey below the floor', () => {
    expect(dotStyle('good', 0)).toEqual(dotStyle('bad', 0))
    expect(dotStyle('good', 0)).toEqual(dotStyle('neutral', 0.05))
  })

  it('uses the verdict hue at or above the floor', () => {
    expect(dotStyle('good', GREY_FLOOR).background).toContain(DOT_HUES.good)
    expect(dotStyle('neutral', 0.5).background).toContain(DOT_HUES.neutral)
    expect(dotStyle('bad', 1).background).toContain(DOT_HUES.bad)
    expect(DOT_HUES.good).toBe('126, 217, 87')
  })

  it('alpha increases with significance', () => {
    const lo = alphaOf(dotStyle('good', 0.3).background)
    const hi = alphaOf(dotStyle('good', 1).background)
    expect(hi).toBeGreaterThan(lo)
    expect(hi).toBeLessThanOrEqual(1)
    expect(lo).toBeGreaterThan(0)
  })

  it('clamps significance outside 0..1', () => {
    expect(dotStyle('bad', 5)).toEqual(dotStyle('bad', 1))
    expect(dotStyle('bad', -3)).toEqual(dotStyle('bad', 0))
    expect(dotStyle('bad', -3).boxShadow).toBe('none')
  })
})
