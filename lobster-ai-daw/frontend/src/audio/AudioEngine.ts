/**
 * AudioEngine
 * -----------
 * Singleton wrapper around the browser's AudioContext. Owns:
 *   - the master GainNode that feeds destination
 *   - one TrackNode per track (gain → panner → analyser → master)
 *   - a per-block AudioBuffer cache
 *   - the source-of-truth for mixer state inside the audio graph
 *
 * Browsers (Chrome/Edge/Firefox/Safari) refuse to start audio output until the
 * user has interacted with the page at least once. That is why initialisation
 * is split into a constructor (cheap, JS-only) and ``ensureStarted()`` which
 * MUST be called from a click/tap handler.
 */
 
import type { TrackMixerState } from '../types/audio'
 
const ANALYSER_FFT_SIZE = 256
const GAIN_SMOOTHING_TIME_CONSTANT = 0.01 // 10ms target time for setTargetAtTime
 
export interface TrackNode {
  gain: GainNode
  panner: StereoPannerNode
  analyser: AnalyserNode
}
 
class AudioEngineImpl {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private tracks: Map<string, TrackNode> = new Map()
  private bufferCache: Map<string, AudioBuffer> = new Map()
  private mixerCache: Map<string, TrackMixerState> = new Map()
  private masterVolumeCache = 0.85
 
  /** Lazily create the AudioContext. Must be called from a user gesture. */
  async ensureStarted(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume()
      }
      return
    }
    const Ctor: typeof AudioContext =
      window.AudioContext ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).webkitAudioContext
    this.ctx = new Ctor()
    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = this.masterVolumeCache
    this.masterGain.connect(this.ctx.destination)
 
    // Re-apply mixer state cached before context start
    for (const [trackId, state] of this.mixerCache) {
      this.registerTrack(trackId)
      this.applyEffectiveGain(trackId, state)
    }
  }
 
  /** Throws if the engine hasn't been started yet. */
  get audioContext(): AudioContext {
    if (!this.ctx) {
      throw new Error('AudioEngine not started. Call ensureStarted() from a user gesture first.')
    }
    return this.ctx
  }
 
  get currentTime(): number {
    return this.ctx?.currentTime ?? 0
  }
 
  get isReady(): boolean {
    return this.ctx !== null
  }
 
  // ---- Track lifecycle -------------------------------------------------
 
  /** Build (or return existing) routing chain for a track. Idempotent. */
  registerTrack(trackId: string): TrackNode {
    const existing = this.tracks.get(trackId)
    if (existing) return existing
    if (!this.ctx || !this.masterGain) {
      throw new Error('Cannot register track before ensureStarted()')
    }
 
    const gain = this.ctx.createGain()
    const panner = this.ctx.createStereoPanner()
    const analyser = this.ctx.createAnalyser()
    analyser.fftSize = ANALYSER_FFT_SIZE
 
    // gain → panner → analyser → master → destination
    gain.connect(panner)
    panner.connect(analyser)
    analyser.connect(this.masterGain)
 
    const node: TrackNode = { gain, panner, analyser }
    this.tracks.set(trackId, node)
 
    // Apply any cached state for this track
    const cached = this.mixerCache.get(trackId)
    if (cached) this.applyEffectiveGain(trackId, cached)
 
    return node
  }
 
  unregisterTrack(trackId: string): void {
    const node = this.tracks.get(trackId)
    if (!node) return
    try {
      node.analyser.disconnect()
      node.panner.disconnect()
      node.gain.disconnect()
    } catch {
      /* nodes may already be disconnected; ignore */
    }
    this.tracks.delete(trackId)
  }
 
  getTrackNode(trackId: string): TrackNode | undefined {
    return this.tracks.get(trackId)
  }
 
  getTrackAnalyser(trackId: string): AnalyserNode | undefined {
    return this.tracks.get(trackId)?.analyser
  }
 
  // ---- Mixer state -----------------------------------------------------
 
  /**
   * Sync the engine's full mixer view in one call. Used on project load
   * when many tracks change at once.
   */
  syncMixerState(
    state: Record<string, TrackMixerState>,
    masterVolume: number,
  ): void {
    this.masterVolumeCache = masterVolume
    if (this.masterGain && this.ctx) {
      // Smooth master volume changes to avoid clicks
      this.masterGain.gain.setTargetAtTime(
        masterVolume,
        this.ctx.currentTime,
        GAIN_SMOOTHING_TIME_CONSTANT,
      )
    }
 
    this.mixerCache.clear()
    for (const [trackId, ms] of Object.entries(state)) {
      this.mixerCache.set(trackId, ms)
    }
    this.recomputeAllEffectiveGains()
  }
 
  /** Update a single track's mixer state. Cheaper than a full sync. */
  updateTrackState(trackId: string, state: TrackMixerState): void {
    this.mixerCache.set(trackId, state)
    // Solo affects every track, so we recompute the whole graph.
    this.recomputeAllEffectiveGains()
  }
 
  setMasterVolume(volume: number): void {
    this.masterVolumeCache = volume
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        volume,
        this.ctx.currentTime,
        GAIN_SMOOTHING_TIME_CONSTANT,
      )
    }
  }
 
  /**
   * Effective gain = (any-soloed ? (this.soloed ? 1 : 0) : 1)
   *                  * (this.muted ? 0 : 1)
   *                  * this.volume
   *
   * Smoothly ramped via setTargetAtTime to prevent clicks on rapid changes.
   */
  private recomputeAllEffectiveGains(): void {
    if (!this.ctx) return
    const anySoloed = Array.from(this.mixerCache.values()).some((s) => s.soloed)
    for (const [trackId, state] of this.mixerCache) {
      this.applyEffectiveGain(trackId, state, anySoloed)
    }
  }
 
  private applyEffectiveGain(
    trackId: string,
    state: TrackMixerState,
    anySoloed?: boolean,
  ): void {
    if (!this.ctx) return
    const node = this.tracks.get(trackId)
    if (!node) return
    const soloMode =
      anySoloed ??
      Array.from(this.mixerCache.values()).some((s) => s.soloed)
    const soloFactor = soloMode ? (state.soloed ? 1 : 0) : 1
    const effective = soloFactor * (state.muted ? 0 : 1) * state.volume
    node.gain.gain.setTargetAtTime(
      effective,
      this.ctx.currentTime,
      GAIN_SMOOTHING_TIME_CONSTANT,
    )
  }
 
  // ---- Buffer cache ----------------------------------------------------
 
  async loadBuffer(blockId: string, audioUrl: string): Promise<AudioBuffer> {
    const cached = this.bufferCache.get(blockId)
    if (cached) return cached
    if (!this.ctx) {
      throw new Error('Cannot load buffer before ensureStarted()')
    }
    const resp = await fetch(audioUrl)
    if (!resp.ok) {
      throw new Error(`Failed to fetch audio at ${audioUrl}: ${resp.status}`)
    }
    const arrayBuffer = await resp.arrayBuffer()
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer)
    this.bufferCache.set(blockId, audioBuffer)
    return audioBuffer
  }
 
  peekBuffer(blockId: string): AudioBuffer | undefined {
    return this.bufferCache.get(blockId)
  }
 
  evictBuffer(blockId: string): void {
    this.bufferCache.delete(blockId)
  }
 
  clearBufferCache(): void {
    this.bufferCache.clear()
  }
 
  async close(): Promise<void> {
    if (!this.ctx) return
    try {
      await this.ctx.close()
    } catch {
      /* ignore */
    }
    this.ctx = null
    this.masterGain = null
    this.tracks.clear()
    this.bufferCache.clear()
  }
}
 
export const audioEngine = new AudioEngineImpl()
export type AudioEngine = AudioEngineImpl
