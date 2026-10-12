import { useEffect, useRef } from 'react'

export type OrbState = 'idle' | 'listening' | 'thinking'

interface Props {
  state: OrbState
  /** Returns 0..1 mic loudness (listening only); read every frame so it never triggers a React render. */
  getLevel: () => number
  /** 0..1 mood: 0 warm amber, 1 green. */
  mood: number
  onTap: () => void
  size?: number
}

interface Particle { r: number; a: number; speed: number; size: number; hue: number; twinkle: number }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
const rgba = (c: [number, number, number], a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`

// Warm palette (neutral) -> green palette (positive)
const WARM: [number, number, number][] = [[240, 165, 58], [255, 90, 90], [255, 220, 170], [255, 45, 122]]
const GREEN: [number, number, number][] = [[126, 217, 87], [60, 200, 150], [210, 255, 180], [150, 230, 90]]
const RING_WARM: [number, number, number] = [240, 165, 58]
const RING_GREEN: [number, number, number] = [126, 217, 87]
/** The canvas is larger than the orb so the outer glow and particles are never clipped. */
const OVERSCAN = 1.5

interface Sim { particles: Particle[]; blobs: { seed: number; rad: number }[]; t: number; smoothLevel: number; smoothMood: number; spin: number }

function makeSim(mood: number): Sim {
  return {
    particles: Array.from({ length: 140 }, (_, i) => ({
      r: 0.52 + Math.pow(Math.random(), 1.6) * 0.42,
      a: Math.random() * Math.PI * 2,
      speed: (0.08 + Math.random() * 0.25) * (Math.random() < 0.5 ? 1 : -1),
      size: 0.6 + Math.random() * 1.8,
      hue: i % 7 === 0 ? 2 : i % 3 === 0 ? 1 : 0,
      twinkle: Math.random() * Math.PI * 2,
    })),
    blobs: Array.from({ length: 5 }, (_, i) => ({ seed: i * 1.7 + 0.3, rad: 0.22 + (i % 3) * 0.06 })),
    t: 0,
    smoothLevel: 0,
    smoothMood: mood,
    spin: 0,
  }
}

export function Orb({ state, getLevel, mood, onTap, size = 240 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const props = useRef({ state, getLevel, mood })
  props.current = { state, getLevel, mood }
  // Simulation state lives outside the effect so a size change (orb shrinking) does not reset it.
  const simRef = useRef<Sim | null>(null)
  if (!simRef.current) simRef.current = makeSim(mood)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const box = size * OVERSCAN
    canvas.width = box * dpr
    canvas.height = box * dpr
    ctx.scale(dpr, dpr)

    const sim = simRef.current!
    const { particles, blobs } = sim

    let raf = 0
    let last = performance.now()
    let breathe = 0

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const { state, getLevel, mood } = props.current
      const thinking = state === 'thinking'
      const listening = state === 'listening'
      sim.smoothLevel = lerp(sim.smoothLevel, listening ? getLevel() : 0, listening ? 0.35 : 0.08)
      sim.smoothMood = lerp(sim.smoothMood, mood, 0.03)
      sim.t += dt * (thinking ? 2.2 : listening ? 1.4 : 1)
      sim.spin += dt * (thinking ? 2.6 : 0.25)
      const t = sim.t
      const spin = sim.spin
      const smoothLevel = sim.smoothLevel
      const smoothMood = sim.smoothMood
      breathe = 0.5 + 0.5 * Math.sin(t * 1.1)

      const cx = box / 2
      const cy = box / 2
      const R = size * 0.36
      const scale = 1 + breathe * 0.02 + smoothLevel * 0.16
      const ringC = mix(RING_WARM, RING_GREEN, smoothMood)
      const palette = WARM.map((c, i) => mix(c, GREEN[i], smoothMood))

      ctx.clearRect(0, 0, box, box)

      // Outer soft glow
      const glow = ctx.createRadialGradient(cx, cy, R * 0.8, cx, cy, R * 1.6)
      glow.addColorStop(0, rgba(ringC, 0.14 + smoothLevel * 0.18))
      glow.addColorStop(1, rgba(ringC, 0))
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, box, box)

      // Disc
      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(scale, scale)
      ctx.beginPath()
      ctx.arc(0, 0, R, 0, Math.PI * 2)
      ctx.fillStyle = '#0d0d10'
      ctx.fill()
      ctx.clip()
      // Blurry gradient blobs drifting inside
      ctx.globalCompositeOperation = 'lighter'
      blobs.forEach((b, i) => {
        const ang = t * 0.5 * (i % 2 ? 1 : -1) + b.seed * 2.1
        const dist = R * (0.25 + 0.2 * Math.sin(t * 0.7 + b.seed))
        const x = Math.cos(ang) * dist
        const y = Math.sin(ang * 0.8 + b.seed) * dist
        const rad = R * (b.rad + smoothLevel * 0.1) * (1 + 0.1 * Math.sin(t * 1.3 + b.seed))
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad * 2.2)
        const c = palette[i % palette.length]
        g.addColorStop(0, rgba(c, 0.55))
        g.addColorStop(0.45, rgba(c, 0.18))
        g.addColorStop(1, rgba(c, 0))
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(x, y, rad * 2.2, 0, Math.PI * 2)
        ctx.fill()
      })
      ctx.globalCompositeOperation = 'source-over'
      // Vignette to keep the edge dark like the reference
      const vig = ctx.createRadialGradient(0, 0, R * 0.55, 0, 0, R)
      vig.addColorStop(0, 'rgba(13,13,16,0)')
      vig.addColorStop(1, 'rgba(13,13,16,0.85)')
      ctx.fillStyle = vig
      ctx.fillRect(-R, -R, R * 2, R * 2)
      ctx.restore()

      // Ring (two arcs, slightly offset, rotating)
      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(scale, scale)
      ctx.lineCap = 'round'
      for (let k = 0; k < 2; k++) {
        const rr = R * (1.07 + k * 0.045)
        const start = spin * (k ? -0.7 : 1) + k * 1.3
        const len = thinking ? Math.PI * (1.1 + 0.5 * Math.sin(t * 2 + k)) : Math.PI * 1.75
        ctx.beginPath()
        ctx.arc(0, 0, rr, start, start + len)
        ctx.strokeStyle = rgba(ringC, k ? 0.35 : 0.85)
        ctx.lineWidth = k ? 1 : 1.8
        ctx.shadowColor = rgba(ringC, 0.9)
        ctx.shadowBlur = 10 + smoothLevel * 14
        ctx.stroke()
      }
      ctx.restore()

      // Particles
      ctx.save()
      ctx.translate(cx, cy)
      const pScale = 1 + smoothLevel * 0.1
      for (const p of particles) {
        p.a += p.speed * dt * (thinking ? 5 : 1)
        const wobble = Math.sin(t * 0.9 + p.twinkle) * 0.02
        const r = (p.r + wobble) * size * 0.5 * pScale * (0.96 + breathe * 0.04)
        const x = Math.cos(p.a) * r
        const y = Math.sin(p.a) * r
        const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.3 + p.twinkle))
        const c = p.hue === 2 ? [255, 255, 255] as [number, number, number] : p.hue === 1 ? palette[1] : ringC
        ctx.fillStyle = rgba(c, tw * (p.r > 0.85 ? 0.5 : 0.9))
        ctx.beginPath()
        ctx.arc(x, y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf)
      else {
        last = performance.now()
        raf = requestAnimationFrame(draw)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [size])

  return (
    <div className="orb-wrap" data-state={state} data-mood={mood.toFixed(2)} style={{ height: size }}>
      <canvas ref={canvasRef} className="orb-canvas" style={{ width: size * OVERSCAN, height: size * OVERSCAN, margin: -(size * (OVERSCAN - 1)) / 2 }} />
      <button className="orb-tap" style={{ width: size, height: size }} aria-label={state === 'listening' ? 'Stop listening' : 'Tap to talk'} onClick={onTap} />
    </div>
  )
}
