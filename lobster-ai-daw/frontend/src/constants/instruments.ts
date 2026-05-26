import type { TimelineTrack } from '../types/audio'

export interface ComposerInstrument {
  id: string
  name: string
  displayName: string
}

export const COMPOSER_INSTRUMENTS: ComposerInstrument[] = [
  { id: 'piano', name: '🎹 Grand Piano', displayName: 'Grand Piano' },
  { id: 'strings', name: '🎻 Strings Ensemble', displayName: 'Strings Ensemble' },
  { id: 'drums', name: '🥁 Acoustic Drums', displayName: 'Acoustic Drums' },
  { id: 'bass', name: '🎸 Bass Guitar', displayName: 'Bass Guitar' },
]

export const DEFAULT_TRACKS: TimelineTrack[] = [
  { trackId: 'piano',   name: 'Grand Piano',      icon: '🎹' },
  { trackId: 'strings', name: 'Strings Ensemble', icon: '🎻' },
  { trackId: 'drums',   name: 'Acoustic Drums',   icon: '🥁' },
  { trackId: 'bass',    name: 'Bass Guitar',      icon: '🎸' },
]

export const PROJECT_ID = 'test-proj'
export const MIN_TIMELINE_DURATION_SECONDS = 60
