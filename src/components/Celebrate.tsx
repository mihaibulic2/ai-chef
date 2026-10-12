import { useEffect, useState } from 'react'

const COLORS = ['#7ed957', '#f0a53a', '#ff2d7a', '#ffffff', '#3cc896']

/** Confetti burst plus a toast. Mount it with a key to replay. */
export function Celebrate({ text, onDone }: { text: string; onDone: () => void }) {
  const [pieces] = useState(() => Array.from({ length: 60 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 0.4, color: COLORS[i % COLORS.length], rot: Math.random() * 360 })))
  useEffect(() => {
    const t = setTimeout(onDone, 2300)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <>
      <div className="confetti" aria-hidden>
        {pieces.map((p, i) => (
          <i key={i} style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`, transform: `rotate(${p.rot}deg)` }} />
        ))}
      </div>
      <div className="toast" role="status">{text}</div>
    </>
  )
}
