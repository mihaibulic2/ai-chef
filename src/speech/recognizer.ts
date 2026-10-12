// Wraps the browser SpeechRecognition API (webkit-prefixed on iOS Safari).
// Finalises on: the spoken word "done", a pause after speech, or an explicit stop().

export interface RecognizerResult {
  text: string
  /** Set when listening ended because of an error; the UI should show it instead of clearing the transcript. */
  error?: string
}

export interface RecognizerHandlers {
  onInterim: (text: string) => void
  onFinal: (result: RecognizerResult) => void
}

export const DONE_WORDS = ['done', "i'm done", 'im done', 'that is it', "that's it", 'thats it']
/** Pause after speech that ends listening. */
export const SILENCE_MS = 2200
/** Time with no speech at all before giving up (iOS can take several seconds to deliver the first result). */
export const NO_SPEECH_MS = 15000

/** If the transcript ends with a done-word, return the transcript without it; otherwise null. */
export function stripDoneWord(text: string): string | null {
  const cleaned = text.trim().replace(/[.!?,]+$/g, '').trim()
  const lower = cleaned.toLowerCase()
  // Longest phrase first so "i'm done" wins over "done".
  for (const w of [...DONE_WORDS].sort((a, b) => b.length - a.length)) {
    if (lower === w) return ''
    if (lower.endsWith(' ' + w)) return cleaned.slice(0, cleaned.length - w.length).trim().replace(/[.,!?]+$/g, '')
  }
  return null
}

type SRResults = ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
type SR = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: { resultIndex: number; results: SRResults }) => void) | null
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

/** Rebuild the transcript from the full results list (iOS re-delivers earlier results, so never append). */
export function joinResults(results: SRResults): { final: string; interim: string } {
  let final = ''
  let interim = ''
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const t = r[0].transcript.trim()
    if (!t) continue
    if (r.isFinal) final += (final ? ' ' : '') + t
    else interim += (interim ? ' ' : '') + t
  }
  return { final, interim }
}

// iOS Safari misbehaves when a new recognition starts before the previous one has fully ended.
let previousEnded: Promise<void> = Promise.resolve()

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

  /** Returns false (after reporting via onFinal) when recognition could not start. */
  start(): boolean {
    const C = ctor()
    if (!C) {
      this.finish('', 'Speech recognition is not available in this browser. Type instead.')
      return false
    }
    const sr = new C()
    let markEnded: () => void = () => undefined
    const endedPromise = new Promise<void>((r) => { markEnded = r })
    const waitFor = previousEnded
    previousEnded = endedPromise
    this.markEnded = markEnded
    sr.continuous = true
    sr.interimResults = true
    sr.lang = 'en-US'
    sr.onresult = (e) => {
      const { final, interim } = joinResults(e.results)
      this.finalText = final
      this.interimText = interim
      const combined = this.text()
      const stripped = stripDoneWord(combined)
      if (stripped !== null) {
        this.finish(stripped)
        return
      }
      this.handlers.onInterim(combined)
      this.armSilence(SILENCE_MS)
    }
    sr.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') {
        this.finish(this.text())
        return
      }
      const msg = e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Microphone access was blocked. Allow it in Safari settings.' : e.error === 'audio-capture' ? 'Could not capture audio.' : `Speech error: ${e.error}`
      this.finish(this.text(), msg)
    }
    // iOS Safari ends recognition by itself after a pause; treat that as "done".
    sr.onend = () => this.finish(this.text())
    this.sr = sr
    // Give the previous session up to a second to end, then start.
    const timeout = new Promise<void>((r) => setTimeout(r, 1000))
    Promise.race([waitFor, timeout]).then(() => {
      if (this.finished) return
      try {
        sr.start()
      } catch (err) {
        this.sr = null
        this.finish('', err instanceof Error ? `Could not start listening (${err.name}). Try again.` : 'Could not start listening.')
        return
      }
      this.armSilence(NO_SPEECH_MS)
    })
    return true
  }

  private markEnded: () => void = () => undefined

  private text(): string {
    return (this.finalText + ' ' + this.interimText).trim()
  }

  private armSilence(ms: number): void {
    if (this.silenceTimer) window.clearTimeout(this.silenceTimer)
    this.silenceTimer = window.setTimeout(() => this.finish(this.text()), ms)
  }

  /** Explicit stop (user tapped): sends what was heard. */
  stop(): void {
    this.finish(this.text())
  }

  /** Abort (user navigated away): drops what was heard, no callback. */
  abort(): void {
    if (this.finished) return
    this.finished = true
    this.teardown(true)
  }

  private teardown(hard = false): void {
    if (this.silenceTimer) window.clearTimeout(this.silenceTimer)
    const sr = this.sr
    this.sr = null
    if (sr) {
      sr.onresult = null
      sr.onerror = null
      // Resolve "ended" when the engine really ends, so the next start does not race it.
      const done = this.markEnded
      sr.onend = () => done()
      window.setTimeout(done, 1500)
      try {
        if (hard) sr.abort()
        else sr.stop()
      } catch {
        done()
      }
    } else {
      this.markEnded()
    }
  }

  private finish(text: string, error?: string): void {
    if (this.finished) return
    this.finished = true
    this.teardown()
    this.handlers.onFinal({ text: text.trim(), error })
  }
}
