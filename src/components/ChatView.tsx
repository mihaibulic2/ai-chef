import { useCallback, useEffect, useRef, useState } from 'react'
import { Orb, type OrbState } from './Orb'
import { GearIcon, PlusIcon, SendIcon } from './Icons'
import { RecipeCarousel } from './RecipeCarousel'
import { useVoice } from './useVoice'
import { busy, judgeMissing, sendUserMessage, startNewChat } from '../state/actions'
import { activeChat, setState, useAppState } from '../state/store'
import { useBusy } from './useBusy'

const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t)
/** Chip colour for the thinking state follows the orb's mood: amber (neutral) to green (positive). */
function moodColor(mood: number): string {
  const t = Math.max(0, Math.min(1, (mood - 0.3) / 0.7))
  return `rgb(${lerp(240, 126, t)}, ${lerp(165, 217, t)}, ${lerp(58, 87, t)})`
}

export function ChatView() {
  const s = useAppState()
  const chat = activeChat(s)
  useBusy()
  const [text, setText] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const [awayFromBottom, setAwayFromBottom] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)

  useEffect(() => { judgeMissing() }, [chat.id])
  const stickOnSend = useCallback((t: string) => { stickToBottom.current = true; void sendUserMessage(t) }, [])
  const { listening, transcript, start, stop, getLevel } = useVoice(stickOnSend)


  const scrollToBottom = useCallback((smooth = true) => {
    const el = listRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  // Follow new content only while the user is already at the bottom.
  const lastText = chat.ui.messages[chat.ui.messages.length - 1]?.text
  useEffect(() => {
    if (stickToBottom.current) scrollToBottom(false)
  }, [chat.ui.messages.length, lastText, transcript, listening, scrollToBottom])
  useEffect(() => { scrollToBottom(false) }, [chat.id, scrollToBottom])

  const onScroll = () => {
    const el = listRef.current
    if (!el) return
    const gap = el.scrollHeight - el.clientHeight - el.scrollTop
    stickToBottom.current = gap < 40
    setScrolled(el.scrollTop > 4)
    setAwayFromBottom(gap > 160)
  }

  const onOrbTap = () => {
    if (listening) stop()
    else if (!busy.chatSending) start()
  }

  const started = chat.ui.messages.length > 0
  const orbState: OrbState = listening ? 'listening' : busy.chatSending ? 'thinking' : 'idle'
  const status = listening ? (
    <span className="chip pink"><span className="dot" />Listening · tap to stop</span>
  ) : busy.chatSending ? (
    <span className="chip" style={{ color: moodColor(chat.ui.mood), background: `${moodColor(chat.ui.mood)}22`, borderColor: 'transparent' }}><span className="dot" />Thinking</span>
  ) : started ? (
    <span className="chip">Tap to talk</span>
  ) : (
    <p className="prompt-line">What are you thinking?</p>
  )

  return (
    <div className="screen">
      <div className={`header${scrolled ? ' scrolled' : ''}`}>
        <h1>Chef</h1>
        <div className="actions">
          <button className="icon-btn" aria-label="New chat" onClick={startNewChat}><PlusIcon /></button>
          <button className="icon-btn" aria-label="Settings" onClick={() => setState({ view: 'settings' })} data-testid="settings-btn"><GearIcon /></button>
        </div>
      </div>
      <div className="scroll chat-scroll" ref={listRef} onScroll={onScroll}>
        <div className={`chat-inner${started ? '' : ' empty'}`}>
          <div className="messages" data-testid="messages">
            {chat.ui.messages.map((m) => (
              m.recipeIds ? (
                <RecipeCarousel key={m.id} chat={chat} recipeIds={m.recipeIds} />
              ) : m.kind === 'selection' || m.kind === 'swap' ? (
                <div key={m.id} className={`bubble user selection rise${m.tone === 'good' ? ' good' : ''}`} data-role="user">
                  <span className="eyebrow">{m.kind === 'swap' ? 'Healthier swap 🎉' : m.tone === 'good' ? 'Selection · healthiest pick 🎉' : 'Selection'}</span>
                  <span className="sel-title">{m.text}</span>
                </div>
              ) : (
                <div key={m.id} className={`bubble ${m.role}${m.error ? ' error' : ''}${m.role === 'user' ? ' rise' : ''}`} data-role={m.role}>
                  {m.text}
                  {m.error && /API key/i.test(m.text) && <> <button onClick={() => setState({ view: 'settings' })}>Open Settings</button></>}
                </div>
              )
            ))}
          </div>
          <div className="chat-top">
            <Orb state={orbState} getLevel={getLevel} mood={chat.ui.mood} onTap={onOrbTap} size={started ? 150 : 240} />
            <div className="status-chip" data-testid="status">{status}</div>
            {chat.ui.cookPlan && !listening && !busy.chatSending && (
              <button className="chip amber" style={{ marginTop: 8 }} onClick={() => setState({ view: 'cook' })} data-testid="resume-cooking"><span className="dot" />Resume cooking · {chat.ui.cookPlan.title}</button>
            )}
            <p className="transcript" data-testid="transcript">{transcript}</p>
          </div>
        </div>
      </div>
      {awayFromBottom && (
        <button className="jump-bottom" onClick={() => scrollToBottom()} aria-label="Jump to latest">↓</button>
      )}
      <form className="composer" onSubmit={(e) => { e.preventDefault(); const t = text; setText(''); stickToBottom.current = true; void sendUserMessage(t) }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Or type here…" disabled={busy.chatSending} data-testid="composer" />
        <button className="send" type="submit" disabled={!text.trim() || busy.chatSending} aria-label="Send" data-testid="send"><SendIcon /></button>
      </form>
    </div>
  )
}
