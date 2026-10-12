// Wraps the browser SpeechRecognition API (webkit-prefixed on iOS Safari).
// Finalises on: the spoken word "done", a pause after speech, or an explicit stop().

export interface RecognizerHandlers {
  onInterim: (text: string) => void
  onFinal: (text: string) => void
  onError: (message: string) => void
}

export const DONE_WORDS = ['done', "i'm done", 'im done', 'that is it', "that's it", 'thats it']
export const SILENCE_MS = 2200

/** If the transcript ends with a done-word, return the transcript without it; otherwise null. */
export function stripDoneWord(text: string): string | null {
  const cleaned = text.trim().replace(/[.!?,]+$/g, '').trim()
  const lower = cleaned.toLowerCase()
  for (const w of DONE_WORDS) {
    if (lower === w) return ''
    if (lower.endsWith(' ' + w)) return cleaned.slice(0, cleaned.length - w.length).trim().replace(/[.,!?]+$/g, '')
  }
  return null
}

type SR = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

function ctor(): (new () => SR) | null {
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function speechSupported(): boolean {
  return ctor() !== null
}

export class Recognizer {
  private sr: SR | null = null
  private finalText = ''
  private interimText = ''
  private silenceTimer: number | null = null
  private finished = false
  private handlers: RecognizerHandlers

  constructor(handlers: RecognizerHandlers) {
    this.handlers = handlers
  }

  start(): void {
    const C = ctor()
    if (!C) {
      this.handlers.onError('Speech recognition is not available in this browser. Type instead.')
      return
    }
    const sr = new C()
    sr.continuous = true
    sr.interimResults = true
    sr.lang = 'en-US'
    sr.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) this.finalText += (this.finalText ? ' ' : '') + r[0].transcript.trim()
        else interim += r[0].transcript
      }
      this.interimText = interim
      const combined = (this.finalText + ' ' + this.interimText).trim()
      const stripped = stripDoneWord(combined)
      if (stripped !== null) {
        this.finish(stripped)
        return
      }
      this.handlers.onInterim(combined)
      this.armSilence()
    }
    sr.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      this.handlers.onError(e.error === 'not-allowed' ? 'Microphone access was blocked.' : `Speech error: ${e.error}`)
      this.finish(this.text())
    }
    // iOS Safari ends recognition by itself after a pause; treat that as "done".
    sr.onend = () => this.finish(this.text())
    this.sr = sr
    try {
      sr.start()
    } catch (err) {
      this.handlers.onError(err instanceof Error ? err.message : 'Could not start listening.')
    }
  }

  private text(): string {
    return (this.finalText + ' ' + this.interimText).trim()
  }

  private armSilence(): void {
    if (this.silenceTimer) window.clearTimeout(this.silenceTimer)
    this.silenceTimer = window.setTimeout(() => this.finish(this.text()), SILENCE_MS)
  }

  /** Explicit stop (user tapped). */
  stop(): void {
    this.finish(this.text())
  }

  private finish(text: string): void {
    if (this.finished) return
    this.finished = true
    if (this.silenceTimer) window.clearTimeout(this.silenceTimer)
    const sr = this.sr
    if (sr) {
      sr.onresult = null
      sr.onend = null
      sr.onerror = null
      try {
        sr.stop()
      } catch {
        // already stopped
      }
    }
    this.handlers.onFinal(text.trim())
  }
}
