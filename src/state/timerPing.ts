// Announces timers hitting zero no matter which screen is showing. iOS Safari has no vibrate(), so a short
// WebAudio chirp is used; its AudioContext must be created inside a tap, hence primeAudio() from the Start button.
import { getState } from './store'
import { remainingNow } from './timers'

let ctx: AudioContext | null = null
const announced = new Set<string>()

export function primeAudio(): void {
  if (ctx) return
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return
  try {
    ctx = new Ctx()
    ctx.resume().catch(() => undefined)
  } catch {
    ctx = null
  }
}

function chirp(): void {
  try {
    navigator.vibrate?.([200, 100, 200])
  } catch {
    // unsupported
  }
  if (!ctx) return
  const t0 = ctx.currentTime
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0, t0 + i * 0.25)
    gain.gain.linearRampToValueAtTime(0.25, t0 + i * 0.25 + 0.02)
    gain.gain.linearRampToValueAtTime(0, t0 + i * 0.25 + 0.18)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t0 + i * 0.25)
    osc.stop(t0 + i * 0.25 + 0.2)
  }
}

export function startTimerWatch(): () => void {
  const id = window.setInterval(() => {
    const now = Date.now()
    for (const chat of getState().chats) {
      for (const t of chat.ui.timers) {
        const key = `${chat.id}:${t.stepKey}:${t.totalSec}:${t.updatedAt}`
        if (t.running && remainingNow(t, now) <= 0) {
          if (!announced.has(key)) {
            announced.add(key)
            chirp()
          }
        }
      }
    }
  }, 500)
  return () => window.clearInterval(id)
}
