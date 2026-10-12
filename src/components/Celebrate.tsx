import { useState } from 'react'

const COLORS = ['#7ed957', '#f0a53a', '#ff2d7a', '#ffffff', '#3cc896', '#ffd166']

/** Full-screen confetti plus a toast. Mount with a changing key to replay; unmount to remove. */
export function Celebrate({ text }: { text: string }) {
  const [pieces] = useState(() => Array.from({ length: 220 }, (_, i) => ({
    left: Math.random() * 100,
    top: -Math.random() * 110,
    delay: Math.random() * 0.6,
    dur: 2 + Math.random() * 1.2,
    color: COLORS[i % COLORS.length],
    rot: Math.random() * 360,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
  })))
  return (
    <>
      <div className="confetti" aria-hidden>
        {pieces.map((p, i) => (
          <i key={i} style={{ left: `${p.left}%`, top: `${p.top}vh`, width: p.w, height: p.h, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, transform: `rotate(${p.rot}deg)` }} />
        ))}
      </div>
      <div className="toast" role="status">{text}</div>
    </>
  )
}
