/**
 * useMixerStore
 * -------------
 * Reactive mixer state for the UI plus a side-effect channel into the
 * AudioEngine. Every mutator does two things in this order:
 *   1. update the Zustand state (so the UI re-renders)
 *   2. push the same change into ``audioEngine`` so the gain nodes change
 *      within the audio graph instantly (≤10ms ramp).
 *
 * Solo semantics: if ANY track has ``soloed=true``, every track that is
 * NOT soloed is silenced regardless of its mute/volume. Once all solo
 * buttons are off, normal mute/volume rules resume. The engine handles
 * this internally in ``recomputeAllEffectiveGains()``.
 */
 
import { create } from 'zustand'
 
import { audioEngine } from '../audio/AudioEngine'
import type { TrackMixerState } from '../types/audio'
 
const DEFAULT_TRACK_STATE: TrackMixerState = {
  volume: 0.8,
  muted: false,
  soloed: false,
}
 
const DEFAULT_MASTER_VOLUME = 0.85
 
interface MixerState {
  tracks: Record<string, TrackMixerState>
  masterVolume: number
 
  registerTrack: (trackId: string, initial?: Partial<TrackMixerState>) => void
  unregisterTrack: (trackId: string) => void
  setVolume: (trackId: string, volume: number) => void
  setMute: (trackId: string, muted: boolean) => void
  toggleMute: (trackId: string) => void
  setSolo: (trackId: string, soloed: boolean) => void
  toggleSolo: (trackId: string) => void
  setMasterVolume: (volume: number) => void
}
 
export const useMixerStore = create<MixerState>((set, get) => ({
  tracks: {},
  masterVolume: DEFAULT_MASTER_VOLUME,
 
  registerTrack: (trackId, initial) => {
    set((s) => {
      if (s.tracks[trackId]) return s
      const newState = { ...DEFAULT_TRACK_STATE, ...initial }
      // Best-effort side effect: if the engine isn't started yet, the call
      // is a no-op and the state is re-applied at ensureStarted() time.
      if (audioEngine.isReady) {
        audioEngine.registerTrack(trackId)
        audioEngine.updateTrackState(trackId, newState)
      } else {
        // Cache for later replay by syncing the full state map once started
        audioEngine.updateTrackState(trackId, newState)
      }
      return { tracks: { ...s.tracks, [trackId]: newState } }
    })
  },
 
  unregisterTrack: (trackId) => {
    set((s) => {
      const next = { ...s.tracks }
      delete next[trackId]
      audioEngine.unregisterTrack(trackId)
      return { tracks: next }
    })
  },
 
  setVolume: (trackId, volume) => {
    set((s) => {
      const existing = s.tracks[trackId]
      if (!existing) return s
      const updated = { ...existing, volume }
      audioEngine.updateTrackState(trackId, updated)
      return { tracks: { ...s.tracks, [trackId]: updated } }
    })
  },
 
  setMute: (trackId, muted) => {
    set((s) => {
      const existing = s.tracks[trackId]
      if (!existing) return s
      const updated = { ...existing, muted }
      audioEngine.updateTrackState(trackId, updated)
      return { tracks: { ...s.tracks, [trackId]: updated } }
    })
  },
 
  toggleMute: (trackId) => {
    const t = get().tracks[trackId]
    if (t) get().setMute(trackId, !t.muted)
  },
 
  setSolo: (trackId, soloed) => {
    set((s) => {
      const existing = s.tracks[trackId]
      if (!existing) return s
      const updated = { ...existing, soloed }
      const nextTracks = { ...s.tracks, [trackId]: updated }
      // Solo affects every track; sync the whole map so the engine recomputes.
      audioEngine.syncMixerState(nextTracks, s.masterVolume)
      return { tracks: nextTracks }
    })
  },
 
  toggleSolo: (trackId) => {
    const t = get().tracks[trackId]
    if (t) get().setSolo(trackId, !t.soloed)
  },
 
  setMasterVolume: (volume) => {
    audioEngine.setMasterVolume(volume)
    set({ masterVolume: volume })
  },
}))
