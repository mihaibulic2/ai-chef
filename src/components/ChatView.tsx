import { useCallback, useEffect, useRef, useState } from 'react'
import { Orb, type OrbState } from './Orb'
import { GearIcon, PlusIcon, SendIcon } from './Icons'
import { RecipeCarousel } from './RecipeCarousel'
import { Recognizer, speechSupported, type RecognizerResult } from '../speech/recognizer'
import { LevelMeter } from '../speech/level'
import { busy, judgeMissing, sendUserMessage, startNewChat } from '../state/actions'
import { activeChat, setState, useAppState } from '../state/store'
import { useBusy } from './useBusy'

export function ChatView() {
  const s = useAppState()
  const chat = activeChat(s)
  useBusy()
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [text, setText] = useState('')
  const recRef = useRef<Recognizer | null>(null)
  const meterRef = useRef<LevelMeter | null>(null)
  // Monotonic token: a meter that resolves after its session ended is stopped immediately.
  const sessionRef = useRef(0)
  // Orb reads this every frame; no React state involved.
  const levelRef = useRef(0)
  const pulseTimer = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => { judgeMissing() }, [chat.id])
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [chat.ui.messages.length, chat.ui.messages[chat.ui.messages.length - 1]?.text])

  const endSession = useCallback(() => {
    sessionRef.current++
    meterRef.current?.stop()
    meterRef.current = null
    window.clearTimeout(pulseTimer.current)
    levelRef.current = 0
    recRef.current = null
    setListening(false)
  }, [])

  const finish = useCallback((result: RecognizerResult) => {
    endSession()
    if (result.error) {
      setTranscript(result.error)
    } else {
      setTranscript('')
      if (result.text) void sendUserMessage(result.text)
    }
  }, [endSession])

  const startListening = useCallback(() => {
    if (!speechSupported()) {
      setTranscript('Voice is not available in this browser. Type below instead.')
      return
    }
    const session = ++sessionRef.current
    setListening(true)
    setTranscript('')
    // Create the meter synchronously inside the tap so the AudioContext is born in the gesture.
    const meter = new LevelMeter()
    const rec = new Recognizer({
      onInterim: (t) => {
        setTranscript(t)
        // Fallback pulse when the mic meter is unavailable: a short bump per new result, then decay.
        if (!meterRef.current) {
          levelRef.current = 0.7
          window.clearTimeout(pulseTimer.current)
          pulseTimer.current = window.setTimeout(() => { levelRef.current = 0 }, 250)
        }
      },
      onFinal: finish,
    })
    recRef.current = rec
    if (!rec.start()) {
      meter.stop()
      return
    }
    meter.start().then(() => {
      if (sessionRef.current !== session) {
        meter.stop()
        return
      }
      meterRef.current = meter
    }).catch(() => {
      // iOS may refuse a second mic consumer; the interim-text fallback keeps the orb alive.
      meter.stop()
    })
  }, [finish])

  const getLevel = useCallback(() => (meterRef.current ? meterRef.current.level() : levelRef.current), [])

  const onOrbTap = () => {
    if (listening) recRef.current?.stop()
    else if (!busy.chatSending) startListening()
  }

  // Leaving the screen mid-sentence drops the words instead of sending half a message.
  useEffect(() => () => { recRef.current?.abort(); endSession() }, [endSession])

  const orbState: OrbState = listening ? 'listening' : busy.chatSending ? 'thinking' : 'idle'
  const statusChip = listening ? (
    <span className="chip pink"><span className="dot" />Listening</span>
  ) : busy.chatSending ? (
    <span className="chip amber"><span className="dot" />Thinking</span>
  ) : chat.ui.messages.length === 0 ? (
    <span className="chip">Tap the orb and say what you're in the mood for</span>
  ) : (
    <span className="chip">Tap to talk</span>
  )

  return (
    <div className="screen">
      <div className="header">
        <h1>Chef</h1>
        <div className="actions">
          <button className="icon-btn" aria-label="New chat" onClick={startNewChat}><PlusIcon /></button>
          <button className="icon-btn" aria-label="Settings" onClick={() => setState({ view: 'settings' })} data-testid="settings-btn"><GearIcon /></button>
        </div>
      </div>
      <div className="chat-top">
        <Orb state={orbState} getLevel={getLevel} mood={chat.ui.mood} onTap={onOrbTap} size={chat.ui.messages.length === 0 ? 240 : 150} />
        <div className="status-chip" data-testid="status">{statusChip}</div>
        {chat.ui.cookPlan && !listening && !busy.chatSending && (
          <button className="chip amber" style={{ marginTop: 8 }} onClick={() => setState({ view: 'cook' })} data-testid="resume-cooking"><span className="dot" />Resume cooking · {chat.ui.cookPlan.title}</button>
        )}
        <p className="transcript" data-testid="transcript">{transcript}</p>
      </div>
      <div className="scroll" ref={listRef}>
        <div className="messages" data-testid="messages">
          {chat.ui.messages.map((m) => (
            m.recipeIds ? (
              <RecipeCarousel key={m.id} chat={chat} recipeIds={m.recipeIds} />
            ) : (
              <div key={m.id} className={`bubble ${m.role}${m.error ? ' error' : ''}`} data-role={m.role}>
                {m.text}
                {m.error && /API key/i.test(m.text) && <> <button onClick={() => setState({ view: 'settings' })}>Open Settings</button></>}
              </div>
            )
          ))}
        </div>
      </div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); const t = text; setText(''); void sendUserMessage(t) }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Or type here…" disabled={busy.chatSending} data-testid="composer" />
        <button className="send" type="submit" disabled={!text.trim() || busy.chatSending} aria-label="Send" data-testid="send"><SendIcon /></button>
      </form>
    </div>
  )
}
