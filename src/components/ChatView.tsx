import { useCallback, useEffect, useRef, useState } from 'react'
import { Orb, type OrbState } from './Orb'
import { GearIcon, PlusIcon, SendIcon } from './Icons'
import { RecipeCarousel } from './RecipeCarousel'
import { Recognizer, speechSupported } from '../speech/recognizer'
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
  const [level, setLevel] = useState(0)
  const [text, setText] = useState('')
  const recRef = useRef<Recognizer | null>(null)
  const meterRef = useRef<LevelMeter | null>(null)
  const rafRef = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => { judgeMissing() }, [chat.id])
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [chat.ui.messages.length, chat.ui.messages[chat.ui.messages.length - 1]?.text])

  const stopMeter = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    meterRef.current?.stop()
    meterRef.current = null
    setLevel(0)
  }, [])

  const finish = useCallback((final: string) => {
    setListening(false)
    setTranscript('')
    stopMeter()
    recRef.current = null
    if (final.trim()) void sendUserMessage(final)
  }, [stopMeter])

  const startListening = useCallback(() => {
    if (!speechSupported()) {
      setTranscript('Voice is not available in this browser. Type below instead.')
      return
    }
    setListening(true)
    setTranscript('')
    const rec = new Recognizer({
      onInterim: (t) => {
        setTranscript(t)
        // Fallback pulse when the mic meter is unavailable: nudge the level on every new word.
        if (!meterRef.current) setLevel(0.5 + Math.random() * 0.3)
      },
      onFinal: finish,
      onError: (msg) => setTranscript(msg),
    })
    recRef.current = rec
    rec.start()
    const meter = new LevelMeter()
    meter.start().then(() => {
      meterRef.current = meter
      const tick = () => {
        setLevel(meter.level())
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
    }).catch(() => {
      // iOS may refuse a second mic consumer; the interim-text fallback above keeps the orb alive.
    })
  }, [finish])

  const onOrbTap = () => {
    if (listening) recRef.current?.stop()
    else if (!busy.chatSending) startListening()
  }

  useEffect(() => () => { recRef.current?.stop(); stopMeter() }, [stopMeter])

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
        <Orb state={orbState} level={level} mood={chat.ui.mood} onTap={onOrbTap} size={chat.ui.messages.length === 0 ? 240 : 150} />
        <div className="status-chip" data-testid="status">{statusChip}</div>
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
