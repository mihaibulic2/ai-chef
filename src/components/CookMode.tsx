import { useEffect, useRef, useState } from 'react'
import { CloseIcon, PauseIcon, PlayIcon, RestartIcon } from './Icons'
import { WrapupCard } from './WrapupCard'
import { formatClock, remainingNow } from '../state/timers'
import { setCurrentStep, timerRemove, timerRestart, timerStart, timerToggle } from '../state/actions'
import { activeChat, setState, useAppState } from '../state/store'
import type { Timer } from '../storage/chats'

function useClock(active: boolean) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setTick((n) => n + 1), 500)
    return () => clearInterval(id)
  }, [active])
}

export function CookMode() {
  const s = useAppState()
  const chat = activeChat(s)
  const plan = chat.ui.cookPlan
  const pagerRef = useRef<HTMLDivElement>(null)
  const steps = plan?.steps ?? []
  const pages = steps.length + 1 // last page is the wrap-up
  const currentIndex = Math.max(0, chat.ui.currentStepKey === '__wrapup' ? steps.length : steps.findIndex((st) => st.key === chat.ui.currentStepKey))
  useClock(chat.ui.timers.some((t) => t.running))
  const pinged = useRef(new Set<string>())

  // Keep the pager on the current step (also after an in-place plan update).
  useEffect(() => {
    const el = pagerRef.current
    if (!el) return
    el.scrollTo({ left: currentIndex * el.clientWidth, behavior: 'auto' })
  }, [currentIndex, plan?.steps.length])

  // Ping when a timer hits zero.
  useEffect(() => {
    chat.ui.timers.forEach((t) => {
      const rem = remainingNow(t)
      if (t.running && rem <= 0 && !pinged.current.has(t.stepKey)) {
        pinged.current.add(t.stepKey)
        try { navigator.vibrate?.([200, 100, 200]) } catch { /* unsupported */ }
      }
      if (rem > 0) pinged.current.delete(t.stepKey)
    })
  })

  if (!plan) {
    return (
      <div className="cook"><div className="center">No cooking plan yet. <button className="btn" onClick={() => setState({ view: 'chat' })}>Back</button></div></div>
    )
  }

  const go = (i: number) => {
    const idx = Math.max(0, Math.min(pages - 1, i))
    setCurrentStep(idx === steps.length ? '__wrapup' : steps[idx].key)
  }
  const onScrollEnd = () => {
    const el = pagerRef.current
    if (!el) return
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    if (idx !== currentIndex) go(idx)
  }
  const timerFor = (key: string): Timer | undefined => chat.ui.timers.find((t) => t.stepKey === key)
  const stepTitle = (key: string) => steps.find((st) => st.key === key)?.title ?? key

  return (
    <div className="cook" data-testid="cook">
      <div className="cook-head">
        <span className="title">{plan.title} · {plan.servings} servings</span>
        <button className="icon-btn" aria-label="Close" onClick={() => setState({ view: 'chat' })} data-testid="cook-close"><CloseIcon /></button>
      </div>
      {chat.ui.timers.length > 0 && (
        <div className="timer-banner" data-testid="timer-banner">
          {chat.ui.timers.map((t) => {
            const rem = remainingNow(t)
            return (
              <button key={t.stepKey} className={`timer-pill${rem <= 0 ? ' done' : ''}`} onClick={() => go(steps.findIndex((st) => st.key === t.stepKey))}>
                <span className="name">{stepTitle(t.stepKey)}</span>
                <span className="clock">{rem <= 0 ? 'Done' : formatClock(rem)}</span>
              </button>
            )
          })}
        </div>
      )}
      <div className="step-pager" ref={pagerRef} onScroll={(e) => { const el = e.currentTarget; clearTimeout((el as unknown as { _t?: number })._t); (el as unknown as { _t?: number })._t = window.setTimeout(onScrollEnd, 120) }}>
        {steps.map((st, i) => {
          const t = timerFor(st.key)
          const rem = t ? remainingNow(t) : 0
          return (
            <div key={st.key} className="step" data-testid={`step-${st.key}`}>
              <div className="n">Step {i + 1} of {steps.length}</div>
              <h2>{st.title}</h2>
              <div className="instr">{st.instruction}</div>
              {st.durationMin != null && st.durationMin > 0 && (
                t ? (
                  <div className={`timer-box${rem <= 0 ? ' done' : ''}`} data-testid={`timer-${st.key}`}>
                    <span className="clock">{rem <= 0 ? 'Done' : formatClock(rem)}</span>
                    <span className="ctl">
                      <button className="icon-btn" aria-label={t.running ? 'Pause' : 'Play'} onClick={() => timerToggle(st.key)}>{t.running ? <PauseIcon /> : <PlayIcon />}</button>
                      <button className="icon-btn" aria-label="Restart" onClick={() => timerRestart(st.key)}><RestartIcon /></button>
                      <button className="icon-btn" aria-label="Remove timer" onClick={() => timerRemove(st.key)}><CloseIcon /></button>
                    </span>
                  </div>
                ) : (
                  <button className="btn" style={{ marginTop: 18, alignSelf: 'flex-start' }} onClick={() => timerStart(st.key, st.durationMin!)} data-testid={`start-timer-${st.key}`}>
                    <PlayIcon /> Start {st.durationMin} min timer
                  </button>
                )
              )}
              {st.tip && <div className="tip">{st.tip}</div>}
            </div>
          )
        })}
        <div className="step" style={{ padding: 0 }}>{currentIndex === steps.length ? <WrapupCard /> : <div className="center">Finish to see your wrap-up</div>}</div>
      </div>
      <div className="cook-nav">
        <button className="btn" onClick={() => go(currentIndex - 1)} disabled={currentIndex === 0} data-testid="prev">Back</button>
        {currentIndex < steps.length && (
          <button className={`btn ${currentIndex === steps.length - 1 ? 'green' : 'primary'}`} onClick={() => go(currentIndex + 1)} data-testid="next">
            {currentIndex === steps.length - 1 ? 'Finish' : 'Next'}
          </button>
        )}
      </div>
    </div>
  )
}
