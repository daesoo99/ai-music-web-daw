/**
 * usePlaybackStore
 * ----------------
 * Zustand store that owns playback state and wraps a single ``BlockScheduler``
 * instance. The store exposes high-level actions (play / pause / stop / seekTo)
 * and reactive state (isPlaying, currentTime, duration) for the UI to subscribe to.
 *
 * The scheduler is held in module scope -- the engine and scheduler are
 * singletons by design, because the AudioContext is.
 *
 * Performance note
 * ----------------
 * ``currentTime`` is updated at ~30 Hz while playing. Components that don't
 * need the moving playhead position should select more stable slices of state,
 * e.g.::
 *
 *     const isPlaying = usePlaybackStore(s => s.isPlaying)   // re-renders rarely
 *     const currentTime = usePlaybackStore(s => s.currentTime) // re-renders 30x/s
 */
 
import { create } from 'zustand'
 
import { BlockScheduler } from '../audio/BlockScheduler'
import type { TimelineBlock } from '../types/audio'
 
// Module-scoped scheduler. Exposed read-only for advanced wiring (e.g. tests).
const scheduler = new BlockScheduler()
 
interface PlaybackState {
  isPlaying: boolean
  currentTime: number
  duration: number
 
  loadBlocks: (blocks: TimelineBlock[]) => void
  play: () => Promise<void>
  pause: () => void
  stop: () => void
  seekTo: (timelineSeconds: number) => Promise<void>
  setCurrentTime: (t: number) => void
}
 
export const usePlaybackStore = create<PlaybackState>((set, get) => {
  // Wire scheduler -> store. These callbacks fire on the engine's clock,
  // not on React renders, so we route them through set().
  scheduler.setPlayheadCallback((t) => {
    set({ currentTime: t })
  })
  scheduler.setOnEnded(() => {
    set({ isPlaying: false })
  })
 
  return {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
 
    loadBlocks: (blocks) => {
      scheduler.loadBlocks(blocks)
      set({ duration: scheduler.totalDuration })
    },
 
    play: async () => {
      if (get().isPlaying) return
      await scheduler.play(get().currentTime)
      set({ isPlaying: true })
    },
 
    pause: () => {
      if (!get().isPlaying) return
      scheduler.pause()
      set({ isPlaying: false })
    },
 
    stop: () => {
      scheduler.stop()
      set({ isPlaying: false, currentTime: 0 })
    },
 
    seekTo: async (t) => {
      await scheduler.seekTo(t)
      set({ currentTime: scheduler.currentTimelineTime })
      // isPlaying may have changed if scheduler restarted; mirror it
      // (seekTo preserves wasPlaying so isPlaying stays the same logically)
    },
    setCurrentTime: (t) => {
      set({ currentTime: t })
    },
  }
})
