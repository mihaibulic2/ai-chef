import { useCallback, useEffect } from 'react'
import { Orb } from './Orb'
import type { Wrapup } from '../ai/types'
import { busy, loadWrapup } from '../state/actions'
import { activeChat, useAppState } from '../state/store'
import { useBusy } from './useBusy'

const capitalize = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t)

export function WrapupCard() {
  const s = useAppState()
  const chat = activeChat(s)
  useBusy()
  useEffect(() => { void loadWrapup() }, [chat.id, chat.ui.cookPlan?.recipeId])
  const w: Wrapup | undefined = chat.ui.wrapup
  const noop = useCallback(() => undefined, [])
  const zero = useCallback(() => 0, [])
  if (!w) {
    const failed = !busy.wrapup && busy.wrapupError
    return (
      <div className="wrap" data-testid="wrapup-loading">
        <div className="pop"><Orb state={busy.wrapup ? 'thinking' : 'idle'} getLevel={zero} mood={chat.ui.mood} onTap={noop} size={170} /></div>
        <p className="subline">{failed ? busy.wrapupError : 'Looking over your meal…'}</p>
        {failed && <button className="btn" onClick={() => void loadWrapup()}>Try again</button>}
      </div>
    )
  }
  const good = w.verdict === 'congrats'
  return (
    <div className="wrap" data-testid="wrapup">
      <div className="pop"><Orb state="idle" getLevel={zero} mood={good ? 1 : 0.45} onTap={noop} size={170} /></div>
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
      <div className="card swap rise" style={{ width: '100%', textAlign: 'left', animationDelay: '0.9s' }} data-testid="wrapup-tip">
        <div className="eyebrow">Health hack · next time</div>
        <div className="swap-change">{capitalize(w.tip.replace(/^next time[,.]?\s*/i, ''))}</div>
      </div>
    </div>
  )
}
