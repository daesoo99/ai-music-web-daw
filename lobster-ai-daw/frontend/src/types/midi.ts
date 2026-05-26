export interface Note {
  pitch: number
  start: number
  duration: number
  velocity: number
}

export interface BlockMidi {
  blockId: string
  notes: Note[]
  detectedKey: string | null
  detectedTempo: number | null
  pitchRange: [number, number] | null
  midiFileUrl: string | null
  status: 'ready' | 'transcribing' | 'failed' | 'unavailable'
  failureReason: string | null
}
