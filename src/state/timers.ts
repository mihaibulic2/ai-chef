import type { Timer } from '../storage/chats'

export function remainingNow(t: Timer, now = Date.now()): number {
  if (!t.running) return t.remainingSec
  return Math.max(0, t.remainingSec - (now - t.updatedAt) / 1000)
}

export function startTimer(stepKey: string, minutes: number, now = Date.now()): Timer {
  const total = Math.round(minutes * 60)
  return { stepKey, totalSec: total, remainingSec: total, running: true, updatedAt: now }
}

export function toggleTimer(t: Timer, now = Date.now()): Timer {
  const rem = remainingNow(t, now)
  return { ...t, remainingSec: rem, running: !t.running && rem > 0, updatedAt: now }
}

export function restartTimer(t: Timer, now = Date.now()): Timer {
  return { ...t, remainingSec: t.totalSec, running: true, updatedAt: now }
}

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}
