import { useCallback, useEffect, useRef, useState } from 'react'
import { Recognizer, speechSupported, type RecognizerResult } from '../speech/recognizer'
import { LevelMeter, levelMeterSupported } from '../speech/level'

export interface Voice {
  listening: boolean
  /** Live transcript while listening, or a short notice afterwards. */
  transcript: string
  start: () => void
  stop: () => void
  /** Read by the orb every frame. */
  getLevel: () => number
  clearTranscript: () => void
}

/** Push-to-talk session shared by the chat orb and the mini orb in cook mode. `onText` gets the final words. */
export function useVoice(onText: (text: string) => void): Voice {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recRef = useRef<Recognizer | null>(null)
  const meterRef = useRef<LevelMeter | null>(null)
  // Monotonic token: a meter that resolves after its session ended is stopped immediately.
  const sessionRef = useRef(0)
  const levelRef = useRef(0)
  const pulseTimer = useRef(0)
  const onTextRef = useRef(onText)
  onTextRef.current = onText

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
    if (result.error) setTranscript(result.error)
    else if (result.text) {
      setTranscript('')
      onTextRef.current(result.text)
    } else setTranscript("Didn't catch that. Tap and try again.")
  }, [endSession])

  const start = useCallback(() => {
    if (recRef.current) return
    if (!speechSupported()) {
      setTranscript('Voice is not available in this browser. Type instead.')
      return
    }
    const session = ++sessionRef.current
    setListening(true)
    setTranscript('')
    const rec = new Recognizer({
      onInterim: (t) => {
        setTranscript(t)
        // Pulse per new result when there is no mic meter (Safari), then decay.
        if (!meterRef.current) {
          levelRef.current = 0.7
          window.clearTimeout(pulseTimer.current)
          pulseTimer.current = window.setTimeout(() => { levelRef.current = 0 }, 250)
        }
      },
      onFinal: finish,
    })
    recRef.current = rec
    if (!rec.start()) return
    if (!levelMeterSupported()) return
    // Chrome only: a loudness meter for a smoother pulse. Created inside the tap so the AudioContext may run.
    const meter = new LevelMeter()
    meter.start().then(() => {
      if (sessionRef.current !== session) {
        meter.stop()
        return
      }
      meterRef.current = meter
    }).catch(() => meter.stop())
  }, [finish])

  const stop = useCallback(() => { recRef.current?.stop() }, [])
  const getLevel = useCallback(() => (meterRef.current ? meterRef.current.level() : levelRef.current), [])
  const clearTranscript = useCallback(() => setTranscript(''), [])

  // Leaving the screen mid-sentence drops the words instead of sending half a message.
  useEffect(() => () => { recRef.current?.abort(); endSession() }, [endSession])

  return { listening, transcript, start, stop, getLevel, clearTranscript }
}
