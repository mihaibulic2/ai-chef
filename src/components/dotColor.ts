import type { Verdict } from '../ai/types'

/** Below this significance the dot is plain grey: the amount is too small to matter. */
export const GREY_FLOOR = 0.12

export const DOT_HUES: Record<Verdict, string> = {
  good: '126, 217, 87',
  neutral: '240, 165, 58',
  bad: '255, 79, 90',
}

/** CSS background for an ingredient dot: hue from verdict, intensity from significance, grey below the floor. */
export function dotStyle(verdict: Verdict, significance: number): { background: string; boxShadow: string } {
  const s = Math.max(0, Math.min(1, significance))
  if (s < GREY_FLOOR) return { background: 'rgba(120,120,128,0.35)', boxShadow: 'none' }
  const t = (s - GREY_FLOOR) / (1 - GREY_FLOOR)
  const alpha = 0.35 + 0.65 * t
  const rgb = DOT_HUES[verdict]
  return { background: `rgba(${rgb}, ${alpha.toFixed(2)})`, boxShadow: t > 0.5 ? `0 0 ${Math.round(6 * t)}px rgba(${rgb}, ${(0.6 * t).toFixed(2)})` : 'none' }
}
