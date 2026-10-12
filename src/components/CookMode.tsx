import { useEffect, useRef, useState } from 'react'
import { CloseIcon, PauseIcon, PlayIcon, RestartIcon } from './Icons'
import { WrapupCard } from './WrapupCard'
import { SwapCard } from './SwapCard'
import { formatClock, isActive, remainingNow } from '../state/timers'
import { primeAudio } from '../state/timerPing'
import { swapsForStep } from '../state/cook'
import { INGREDIENTS_KEY, setCurrentStep, timerRemove, timerRestart, timerStart, timerToggle } from '../state/actions'
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
  const swapsDone = chat.ui.swapsDone ?? []
  // Pages: ingredients, then one per step, then the wrap-up.
  const pages = steps.length + 2
  const wrapIndex = steps.length + 1
  const key = chat.ui.currentStepKey
  const stepIdx = steps.findIndex((st) => st.key === key)
  const currentIndex = key === '__wrapup' ? wrapIndex : stepIdx >= 0 ? stepIdx + 1 : 0
  useClock(chat.ui.timers.some((t) => isActive(t)))
  const touching = useRef(false)
  const scrollTimer = useRef(0)

  // Keep the pager on the current page (also after an in-place plan update).
  useEffect(() => {
    const el = pagerRef.current
    if (!el) return
    el.scrollTo({ left: currentIndex * el.clientWidth, behavior: 'auto' })
  }, [currentIndex, plan?.steps.length])

  useEffect(() => () => window.clearTimeout(scrollTimer.current), [])

  if (!plan) {
    return (
      <div className="cook"><div className="center">No cooking plan yet. <button className="btn" onClick={() => setState({ view: 'chat' })}>Back</button></div></div>
    )
  }

  const go = (i: number) => {
    const idx = Math.max(0, Math.min(pages - 1, i))
    setCurrentStep(idx === 0 ? INGREDIENTS_KEY : idx === wrapIndex ? '__wrapup' : steps[idx - 1].key)
  }
  // Only settle on a page once the finger is up, so we never scroll under a drag.
  const onScrollEnd = () => {
    const el = pagerRef.current
    if (!el || touching.current) return
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    if (idx !== currentIndex) go(idx)
  }
  const scheduleScrollEnd = () => {
    window.clearTimeout(scrollTimer.current)
    scrollTimer.current = window.setTimeout(onScrollEnd, 120)
  }
  const goToStep = (stepKey: string) => {
    const i = steps.findIndex((st) => st.key === stepKey)
    if (i >= 0) go(i + 1)
  }
  const timerFor = (stepKey: string): Timer | undefined => chat.ui.timers.find((t) => t.stepKey === stepKey)
  const stepTitle = (stepKey: string) => steps.find((st) => st.key === stepKey)?.title ?? stepKey
  const nextLabel = currentIndex === 0 ? 'Start cooking' : currentIndex === steps.length ? 'Finish' : 'Next'

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
              <button key={t.stepKey} className={`timer-pill${rem <= 0 ? ' done' : ''}`} onClick={() => goToStep(t.stepKey)}>
                <span className="name">{stepTitle(t.stepKey)}</span>
                <span className="clock">{rem <= 0 ? 'Done' : formatClock(rem)}</span>
              </button>
            )
          })}
        </div>
      )}
      <div
        className="step-pager"
        ref={pagerRef}
        onScroll={scheduleScrollEnd}
        onTouchStart={() => { touching.current = true }}
        onTouchEnd={() => { touching.current = false; scheduleScrollEnd() }}
        onTouchCancel={() => { touching.current = false; scheduleScrollEnd() }}
      >
        <div className="step" data-testid="ingredients-page">
          <div className="n">Before you start</div>
          <h2>Get your ingredients</h2>
          <ul className="ingredients">
            {plan.ingredients.map((ing, i) => (
              <li key={i}><span>{ing.name}</span><span className="qty">{ing.quantity}</span></li>
            ))}
          </ul>
          {(plan.swaps ?? []).map((sw) => <SwapCard key={sw.id} swap={sw} done={swapsDone.includes(sw.id)} mode="shop" />)}
        </div>
        {steps.map((st, i) => {
          const t = timerFor(st.key)
          const rem = t ? remainingNow(t) : 0
          const swaps = swapsForStep(plan, st.key)
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
                      {rem > 0 && <button className="icon-btn" aria-label={t.running ? 'Pause' : 'Play'} onClick={() => timerToggle(st.key)}>{t.running ? <PauseIcon /> : <PlayIcon />}</button>}
                      <button className="icon-btn" aria-label="Restart" onClick={() => timerRestart(st.key)}><RestartIcon /></button>
                      <button className="icon-btn" aria-label="Remove timer" onClick={() => timerRemove(st.key)}><CloseIcon /></button>
                    </span>
                  </div>
                ) : (
                  <button className="btn" style={{ marginTop: 18, alignSelf: 'flex-start' }} onClick={() => { primeAudio(); timerStart(st.key, st.durationMin!) }} data-testid={`start-timer-${st.key}`}>
                    <PlayIcon /> Start {st.durationMin} min timer
                  </button>
                )
              )}
              {swaps.map((sw) => <SwapCard key={sw.id} swap={sw} done={swapsDone.includes(sw.id)} mode="step" />)}
              {st.tip && <div className="tip">{st.tip}</div>}
            </div>
          )
        })}
        <div className="step" style={{ padding: 0 }}>{currentIndex === wrapIndex ? <WrapupCard /> : <div className="center">Finish to see your wrap-up</div>}</div>
      </div>
      <div className="cook-nav">
        <button className="btn" onClick={() => go(currentIndex - 1)} disabled={currentIndex === 0} data-testid="prev">Back</button>
        {currentIndex < wrapIndex && (
          <button className={`btn ${currentIndex === steps.length ? 'green' : 'primary'}`} onClick={() => go(currentIndex + 1)} data-testid="next">
            {nextLabel}
          </button>
        )}
      </div>
    </div>
  )
}
