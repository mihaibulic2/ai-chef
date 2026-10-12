// Microphone loudness meter for the orb. Independent of speech recognition; may be refused on iOS when
// recognition already holds the mic, in which case start() rejects and the caller falls back.

export class LevelMeter {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private analyser: AnalyserNode | null = null
  private buf: Uint8Array<ArrayBuffer> | null = null

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.ctx = new Ctx()
    const src = this.ctx.createMediaStreamSource(this.stream)
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 512
    src.connect(this.analyser)
    this.buf = new Uint8Array(new ArrayBuffer(this.analyser.fftSize))
    if (this.ctx.state === 'suspended') await this.ctx.resume()
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
    this.stream?.getTracks().forEach((t) => t.stop())
    this.ctx?.close().catch(() => undefined)
    this.stream = null
    this.ctx = null
    this.analyser = null
  }
}
