import { describe, expect, it } from 'vitest'
import { formatClock, remainingNow, restartTimer, startTimer, toggleTimer } from './timers'

const T0 = 1_700_000_000_000

describe('startTimer', () => {
  it('creates a running timer with totalSec = minutes*60', () => {
    const t = startTimer('cook-pasta', 9, T0)
    expect(t).toEqual({ stepKey: 'cook-pasta', totalSec: 540, remainingSec: 540, running: true, updatedAt: T0 })
  })
})

describe('remainingNow', () => {
  it('subtracts elapsed time for a running timer', () => {
    const t = startTimer('a', 9, T0)
    expect(remainingNow(t, T0)).toBe(540)
    expect(remainingNow(t, T0 + 10_000)).toBe(530)
  })

  it('never goes below zero', () => {
    const t = startTimer('a', 1, T0)
    expect(remainingNow(t, T0 + 120_000)).toBe(0)
  })

  it('returns remainingSec unchanged for a paused timer', () => {
    const t = toggleTimer(startTimer('a', 9, T0), T0 + 10_000)
    expect(t.running).toBe(false)
    expect(remainingNow(t, T0 + 1_000_000)).toBe(530)
  })
})

describe('toggleTimer', () => {
  it('pauses a running timer and freezes remaining time', () => {
    const t = toggleTimer(startTimer('a', 9, T0), T0 + 10_000)
    expect(t.running).toBe(false)
    expect(t.remainingSec).toBe(530)
    expect(t.updatedAt).toBe(T0 + 10_000)
  })

  it('resumes a paused timer from the frozen time', () => {
    const paused = toggleTimer(startTimer('a', 9, T0), T0 + 10_000)
    const resumed = toggleTimer(paused, T0 + 50_000)
    expect(resumed.running).toBe(true)
    expect(resumed.updatedAt).toBe(T0 + 50_000)
    expect(remainingNow(resumed, T0 + 50_000)).toBe(530)
    expect(remainingNow(resumed, T0 + 55_000)).toBe(525)
  })

  it('does not resume a timer at zero', () => {
    const paused = toggleTimer(startTimer('a', 1, T0), T0 + 120_000)
    expect(paused.running).toBe(false)
    expect(remainingNow(paused, T0 + 120_000)).toBe(0)
    const again = toggleTimer(paused, T0 + 130_000)
    expect(again.running).toBe(false)
    expect(remainingNow(again, T0 + 200_000)).toBe(0)
  })
})

describe('restartTimer', () => {
  it('resets to totalSec and running', () => {
    const paused = toggleTimer(startTimer('a', 9, T0), T0 + 10_000)
    const r = restartTimer(paused, T0 + 20_000)
    expect(r.running).toBe(true)
    expect(r.remainingSec).toBe(540)
    expect(r.totalSec).toBe(540)
    expect(r.stepKey).toBe('a')
    expect(r.updatedAt).toBe(T0 + 20_000)
    expect(remainingNow(r, T0 + 20_000)).toBe(540)
  })
})

describe('formatClock', () => {
  it('formats m:ss', () => {
    expect(formatClock(540)).toBe('9:00')
    expect(formatClock(5)).toBe('0:05')
    expect(formatClock(65)).toBe('1:05')
    expect(formatClock(0)).toBe('0:00')
  })

  it('rounds partial seconds up', () => {
    expect(formatClock(59.2)).toBe('1:00')
    expect(formatClock(0.1)).toBe('0:01')
  })

  it('clamps negatives to 0:00', () => {
    expect(formatClock(-3)).toBe('0:00')
  })
})
