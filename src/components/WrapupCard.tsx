import { useEffect } from 'react'
import type { Wrapup } from '../ai/types'
import { busy, loadWrapup } from '../state/actions'
import { activeChat, setState, useAppState } from '../state/store'
import { useBusy } from './useBusy'

export function WrapupCard() {
  const s = useAppState()
  const chat = activeChat(s)
  useBusy()
  useEffect(() => { void loadWrapup() }, [chat.id, chat.ui.cookPlan?.recipeId])
  const w: Wrapup | undefined = chat.ui.wrapup
  if (!w) {
    const failed = !busy.wrapup && busy.wrapupError
    return (
      <div className="wrap" data-testid="wrapup-loading">
        <div className="glow congrats pop"><div className="ring"><span className="spinner" style={{ width: 28, height: 28 }} /></div></div>
        <p className="subline">{failed ? busy.wrapupError : 'Adding it up…'}</p>
        {failed && <button className="btn" onClick={() => void loadWrapup()}>Try again</button>}
      </div>
    )
  }
  const good = w.verdict === 'congrats'
  return (
    <div className="wrap" data-testid="wrapup">
      <div className={`glow ${w.verdict} pop`}><div className="ring">{good ? '✓' : '↗'}</div></div>
      <h2 className="headline rise" style={{ animationDelay: '0.1s' }}>{w.headline}</h2>
      <p className="subline rise" style={{ animationDelay: '0.2s' }}>{w.streak}</p>
      <div className="highlights">
        {w.highlights.map((h, i) => (
          <div key={i} className="card hl rise" style={{ animationDelay: `${0.3 + i * 0.08}s` }}>
            <span className="dot" style={{ background: good ? 'var(--green)' : 'var(--amber)' }} />
            <span>{h}</span>
          </div>
        ))}
      </div>
      <div className="stats">
        {w.stats.map((st, i) => (
          <div key={i} className="card stat rise" style={{ animationDelay: `${0.55 + i * 0.08}s` }}>
            <div className="v">{st.value}</div>
            <div className="l">{st.label}</div>
          </div>
        ))}
      </div>
      <div className="card tipbox rise" style={{ animationDelay: '0.9s' }}><b>Next time.</b> {w.tip.replace(/^next time[,.]?\s*/i, '')}</div>
      <button className="btn primary rise" style={{ marginTop: 18, animationDelay: '1s' }} onClick={() => setState({ view: 'chat' })}>Done</button>
    </div>
  )
}
