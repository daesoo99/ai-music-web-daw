import { create } from 'zustand'
import type { BlockMidi } from '../types/midi'

const LRU_MAX = 20

interface NotesState {
  midi: Record<string, BlockMidi>
  loading: Record<string, boolean>
  errors: Record<string, string>
  accessOrder: string[]
  
  fetchMidi: (blockId: string) => Promise<BlockMidi | null>
  applyWsUpdate: (blockId: string, status: BlockMidi['status']) => void
  evictIfNeeded: () => void
  clear: (blockId: string) => void
}

export const useNotesStore = create<NotesState>((set, get) => ({
  midi: {},
  loading: {},
  errors: {},
  accessOrder: [],

  fetchMidi: async (blockId: string) => {
    const existing = get().midi[blockId]
    if (existing && existing.status === 'ready') {
      set(s => ({
        accessOrder: [blockId, ...s.accessOrder.filter(id => id !== blockId)]
      }))
      return existing
    }
    
    if (get().loading[blockId]) return null
    
    set(s => ({ loading: { ...s.loading, [blockId]: true } }))
    try {
      const res = await fetch(`/api/blocks/${blockId}/midi`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const midi: BlockMidi = {
        blockId: data.block_id,
        notes: data.notes ?? [],
        detectedKey: data.detected_key ?? null,
        detectedTempo: data.detected_tempo ?? null,
        pitchRange: data.pitch_range ?? null,
        midiFileUrl: data.midi_file_url ?? null,
        status: data.status,
        failureReason: data.failure_reason ?? null,
      }
      set(s => ({
        midi: { ...s.midi, [blockId]: midi },
        loading: { ...s.loading, [blockId]: false },
        accessOrder: [blockId, ...s.accessOrder.filter(id => id !== blockId)],
      }))
      get().evictIfNeeded()
      return midi
    } catch (e) {
      set(s => ({
        loading: { ...s.loading, [blockId]: false },
        errors: { ...s.errors, [blockId]: (e as Error).message },
      }))
      return null
    }
  },

  applyWsUpdate: (blockId, status) => {
    set(s => {
      if (!s.midi[blockId]) return s
      return { midi: { ...s.midi, [blockId]: { ...s.midi[blockId], status } } }
    })
    if (status === 'ready') {
      get().fetchMidi(blockId)
    }
  },

  evictIfNeeded: () => {
    const { accessOrder } = get()
    if (accessOrder.length <= LRU_MAX) return
    const toEvict = accessOrder.slice(LRU_MAX)
    set(s => {
      const newMidi = { ...s.midi }
      for (const id of toEvict) delete newMidi[id]
      return { midi: newMidi, accessOrder: s.accessOrder.slice(0, LRU_MAX) }
    })
  },

  clear: (blockId) => {
    set(s => {
      const newMidi = { ...s.midi }
      delete newMidi[blockId]
      return {
        midi: newMidi,
        accessOrder: s.accessOrder.filter(id => id !== blockId),
      }
    })
  },
}))
