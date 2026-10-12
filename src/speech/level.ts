// Microphone loudness meter for the orb. Independent of speech recognition; may be refused on iOS when
// recognition already holds the mic, in which case start() rejects and the caller falls back.

/** Safari (iPhone) cannot share the mic between recognition and getUserMedia; only use the meter on browsers with the unprefixed API. */
export function levelMeterSupported(): boolean {
  return 'SpeechRecognition' in window && !!navigator.mediaDevices?.getUserMedia
}

export class LevelMeter {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private analyser: AnalyserNode | null = null
  private buf: Uint8Array<ArrayBuffer> | null = null
  private stopped = false

  /** Call synchronously from the tap handler so the AudioContext is created inside the user gesture. */
  async start(): Promise<void> {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx || !navigator.mediaDevices?.getUserMedia) throw new Error('Audio unavailable')
    this.ctx = new Ctx()
    // Do not await: on some iOS versions resume() only settles inside a gesture.
    this.ctx.resume().catch(() => undefined)
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    if (this.stopped) {
      stream.getTracks().forEach((t) => t.stop())
      throw new Error('stopped')
    }
    this.stream = stream
    try {
      const src = this.ctx.createMediaStreamSource(stream)
      this.analyser = this.ctx.createAnalyser()
      this.analyser.fftSize = 512
      src.connect(this.analyser)
      this.buf = new Uint8Array(new ArrayBuffer(this.analyser.fftSize))
    } catch (err) {
      this.stop()
      throw err
    }
  }

  /** 0..1 RMS loudness, roughly normalised for speech. */
  level(): number {
    if (!this.analyser || !this.buf) return 0
    this.analyser.getByteTimeDomainData(this.buf)
    let sum = 0
    for (let i = 0; i < this.buf.length; i++) {
      const v = (this.buf[i] - 128) / 128
      sum += v * v
    }
    const rms = Math.sqrt(sum / this.buf.length)
    return Math.min(1, rms * 4)
  }

  stop(): void {
    this.stopped = true
    this.stream?.getTracks().forEach((t) => t.stop())
    this.ctx?.close().catch(() => undefined)
    this.stream = null
    this.ctx = null
    this.analyser = null
  }
}
