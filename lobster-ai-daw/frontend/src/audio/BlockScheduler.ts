/**
 * BlockScheduler
 * --------------
 * Schedules a list of TimelineBlocks onto the AudioContext clock with
 * equal-power-style crossfades at block boundaries.
 *
 * Crossfade strategy
 * ------------------
 * For two blocks A, B on the same track where A.end == B.start (within 10ms
 * tolerance), the scheduler:
 *   1. shifts B's start in the AUDIO CONTEXT time by ``CROSSFADE_DURATION``
 *      earlier than its nominal start, so the two buffers overlap by 75ms
 *   2. ramps A's per-block fade gain from 1 ??0 over the last 75ms
 *   3. ramps B's per-block fade gain from 0 ??1 over the first 75ms
 *
 * Net effect: the timeline UI still shows A ending exactly where B begins,
 * but the audio glides between them with no audible click or dip.
 *
 * Routing
 * -------
 * Each scheduled block creates its own ``fadeGain`` node that lives only for
 * the duration of that block's playback:
 *
 *     BufferSource ??fadeGain ??track.gain ??track.panner ??track.analyser
 *                  ??master.gain ??destination
 *
 * The fadeGain is per-block so envelopes don't fight each other when blocks
 * overlap during a crossfade.
 */
 
import { audioEngine } from './AudioEngine'
import type { TimelineBlock } from '../types/audio'
 
/** Length of the crossfade ramp in seconds. 75ms is a balance between
 *  smoothness and not bleeding the next block too early. */
export const CROSSFADE_DURATION = 0.075
 
/** Edge declick on first/last block boundaries (no crossfade neighbour). */
const EDGE_DECLICK_DURATION = 0.005
 
/** Tolerance for "are two blocks abutting?" comparison. */
const ABUT_TOLERANCE = 0.01
 
/** Safety lead time -- never schedule sources in the past. */
const SCHEDULE_LEAD_TIME = 0.05
 
/** Playhead refresh rate (Hz). 30fps is plenty for a moving cursor. */
const PLAYHEAD_REFRESH_HZ = 30
 
export type PlayheadCallback = (timelineSeconds: number) => void
export type EndedCallback = () => void
 
interface ScheduledSource {
  blockId: string
  trackId: string
  source: AudioBufferSourceNode
  fadeGain: GainNode
}
 
export class BlockScheduler {
  private blocks: TimelineBlock[] = []
  private active: ScheduledSource[] = []
 
  private playbackStartContextTime = 0
  private playbackStartTimeline = 0
  private isPlaying = false
 
  private playheadInterval: number | null = null
  private onPlayheadUpdate: PlayheadCallback | null = null
  private onEnded: EndedCallback | null = null
 
  // ---- Public API ------------------------------------------------------
 
  loadBlocks(blocks: TimelineBlock[]): void {
    // Defensive copy + sort. We rely on sorted order for neighbour lookup.
    this.blocks = [...blocks].sort(
      (a, b) => a.timelineStartSeconds - b.timelineStartSeconds,
    )
  }
 
  setPlayheadCallback(cb: PlayheadCallback | null): void {
    this.onPlayheadUpdate = cb
  }
 
  setOnEnded(cb: EndedCallback | null): void {
    this.onEnded = cb
  }
 
  get totalDuration(): number {
    if (this.blocks.length === 0) return 0
    return Math.max(
      ...this.blocks.map(
        (b) => b.timelineStartSeconds + b.durationSeconds,
      ),
    )
  }
 
  get currentTimelineTime(): number {
    if (!this.isPlaying) return this.playbackStartTimeline
    const elapsed = audioEngine.currentTime - this.playbackStartContextTime
    return Math.min(
      this.playbackStartTimeline + elapsed,
      this.totalDuration,
    )
  }
 
  /** Begin playback from a timeline position (defaults to 0). */
  async play(fromTimelineSeconds = 0): Promise<void> {
    await audioEngine.ensureStarted()
    this.stop({ silent: true })
 
    // Identify blocks that will be audible in this playback
    const relevant = this.blocks.filter(
      (b) =>
        b.timelineStartSeconds + b.durationSeconds > fromTimelineSeconds,
    )
    if (relevant.length === 0) {
      // Nothing to play; emit ended immediately
      if (this.onEnded) this.onEnded()
      return
    }
 
    // Pre-load and decode all involved audio. Buffers are cached, so this
    // is cheap on subsequent plays.
    await Promise.all(
      relevant.map((b) => audioEngine.loadBuffer(b.blockId, b.audioUrl)),
    )
 
    const ctxNow = audioEngine.currentTime
    const startCtxTime = ctxNow + SCHEDULE_LEAD_TIME
 
    this.playbackStartContextTime = startCtxTime
    this.playbackStartTimeline = fromTimelineSeconds
    this.isPlaying = true
 
    // Group by track so we can compute per-track abutting relations
    const byTrack = new Map<string, TimelineBlock[]>()
    for (const b of relevant) {
      const arr = byTrack.get(b.trackId) ?? []
      arr.push(b)
      byTrack.set(b.trackId, arr)
    }
 
    for (const [trackId, trackBlocks] of byTrack) {
      // Make sure the track has a routing chain
      audioEngine.registerTrack(trackId)
      trackBlocks.sort(
        (a, b) => a.timelineStartSeconds - b.timelineStartSeconds,
      )
 
      for (let i = 0; i < trackBlocks.length; i++) {
        const block = trackBlocks[i]
        const prev = i > 0 ? trackBlocks[i - 1] : null
        const next =
          i < trackBlocks.length - 1 ? trackBlocks[i + 1] : null
 
        const abutsPrev =
          prev !== null &&
          Math.abs(
            prev.timelineStartSeconds +
              prev.durationSeconds -
              block.timelineStartSeconds,
          ) < ABUT_TOLERANCE
        const abutsNext =
          next !== null &&
          Math.abs(
            block.timelineStartSeconds +
              block.durationSeconds -
              next.timelineStartSeconds,
          ) < ABUT_TOLERANCE
 
        this.scheduleBlock(block, trackId, startCtxTime, fromTimelineSeconds, abutsPrev, abutsNext)
      }
    }
 
    this.startPlayheadTimer()
  }
 
  pause(): void {
    if (!this.isPlaying) return
    // Capture position before stop() resets isPlaying
    const finalTime = this.currentTimelineTime
    this.stop({ silent: true })
    this.playbackStartTimeline = finalTime
    if (this.onPlayheadUpdate) this.onPlayheadUpdate(finalTime)
  }
 
  stop(opts: { silent?: boolean } = {}): void {
    const { silent = false } = opts
 
    for (const entry of this.active) {
      try {
        entry.source.onended = null
        entry.source.stop()
      } catch {
        /* already stopped */
      }
      try {
        entry.source.disconnect()
        entry.fadeGain.disconnect()
      } catch {
        /* already disconnected */
      }
    }
    this.active = []
 
    if (this.playheadInterval !== null) {
      window.clearInterval(this.playheadInterval)
      this.playheadInterval = null
    }
 
    this.isPlaying = false
    if (!silent) {
      this.playbackStartTimeline = 0
      if (this.onPlayheadUpdate) this.onPlayheadUpdate(0)
    }
  }
 
  async seekTo(timelineSeconds: number): Promise<void> {
    const wasPlaying = this.isPlaying
    this.stop({ silent: true })
    this.playbackStartTimeline = Math.max(0, Math.min(timelineSeconds, Math.max(600, this.totalDuration)))
    if (this.onPlayheadUpdate) this.onPlayheadUpdate(this.playbackStartTimeline)
    if (wasPlaying) {
      await this.play(this.playbackStartTimeline)
    }
  }
 
  // ---- Internals -------------------------------------------------------
 
  private scheduleBlock(
    block: TimelineBlock,
    trackId: string,
    playbackStartCtx: number,
    fromTimelineSeconds: number,
    abutsPrev: boolean,
    abutsNext: boolean,
  ): void {
    const trackNode = audioEngine.getTrackNode(trackId)
    if (!trackNode) return
    const buffer = audioEngine.peekBuffer(block.blockId)
    if (!buffer) {
      console.warn(`[Scheduler] No buffer for block ${block.blockId}; skipping.`)
      return
    }
 
    // How far into this block we should start (handles seek into mid-block)
    const blockSkip = Math.max(
      0,
      fromTimelineSeconds - block.timelineStartSeconds,
    )
    if (blockSkip >= block.durationSeconds) return
 
    const ctx = audioEngine.audioContext
 
    // Nominal context-time at which this block's timeline-start aligns
    const nominalCtxStart =
      playbackStartCtx +
      Math.max(0, block.timelineStartSeconds - fromTimelineSeconds)
 
    // If we crossfade with the previous block AND we're starting at the
    // block's true beginning, shift earlier by CROSSFADE_DURATION to overlap.
    const overlapWithPrev = abutsPrev && blockSkip === 0
    const sourceCtxStart = overlapWithPrev
      ? nominalCtxStart - CROSSFADE_DURATION
      : nominalCtxStart
 
    const audioPlayLength = block.durationSeconds - blockSkip
    const sourceCtxEnd = sourceCtxStart + audioPlayLength
 
    // Per-block fade gain
    const fadeGain = ctx.createGain()
    fadeGain.gain.value = 0
    fadeGain.connect(trackNode.gain)
 
    // Fade-in envelope
    const fadeInDuration = overlapWithPrev
      ? CROSSFADE_DURATION
      : EDGE_DECLICK_DURATION
    fadeGain.gain.setValueAtTime(0, sourceCtxStart)
    fadeGain.gain.linearRampToValueAtTime(1, sourceCtxStart + fadeInDuration)
 
    // Fade-out envelope at the natural end of the block
    const fadeOutDuration = abutsNext
      ? CROSSFADE_DURATION
      : EDGE_DECLICK_DURATION
    const fadeOutStart = Math.max(
      sourceCtxStart + fadeInDuration,
      sourceCtxEnd - fadeOutDuration,
    )
    fadeGain.gain.setValueAtTime(1, fadeOutStart)
    fadeGain.gain.linearRampToValueAtTime(0, sourceCtxEnd)
 
    // Create and start the source
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(fadeGain)
    source.start(sourceCtxStart, blockSkip, audioPlayLength)
 
    const entry: ScheduledSource = {
      blockId: block.blockId,
      trackId,
      source,
      fadeGain,
    }
    this.active.push(entry)
 
    source.onended = () => {
      try {
        source.disconnect()
        fadeGain.disconnect()
      } catch {
        /* ignore */
      }
      this.active = this.active.filter((s) => s !== entry)
    }
  }
 
  private startPlayheadTimer(): void {
    if (this.playheadInterval !== null) {
      window.clearInterval(this.playheadInterval)
    }
    const intervalMs = Math.round(1000 / PLAYHEAD_REFRESH_HZ)
    this.playheadInterval = window.setInterval(() => {
      if (!this.isPlaying) return
      const t = this.currentTimelineTime
      if (this.onPlayheadUpdate) this.onPlayheadUpdate(t)
      // Auto-stop at end of timeline
      if (t >= this.totalDuration) {
        this.stop({ silent: true })
        if (this.onPlayheadUpdate) this.onPlayheadUpdate(this.totalDuration)
        if (this.onEnded) this.onEnded()
      }
    }, intervalMs)
  }
}
