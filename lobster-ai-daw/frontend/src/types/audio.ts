/**
 * Shared audio-domain types used by the engine, scheduler, and Zustand stores.
 *
 * The frontend works with a slim TimelineBlock that contains only what
 * the audio engine and the timeline UI consume.
 */

export interface TimelineTrack {
  trackId: string;
  name: string;          // shown in the track header
  instrument?: string;   // optional human-readable label
  icon?: string;         // visual icon (emoji or asset path)
}

export interface TimelineBlock {
  blockId: string;
  trackId: string;
  audioUrl: string;             // resolvable URL the browser can fetch()
  timelineStartSeconds: number; // where this block starts on the timeline
  durationSeconds: number;      // nominal duration
  prompt?: string;              // text prompt used for generation
  isRepaintOf?: string;         // original block_id if this is a repaint
  isActive?: boolean;           // false if the block is deactivated (rendered gray)
}

export interface TrackMixerState {
  volume: number;   // 0.0 - 1.0
  muted: boolean;
  soloed: boolean;
}
