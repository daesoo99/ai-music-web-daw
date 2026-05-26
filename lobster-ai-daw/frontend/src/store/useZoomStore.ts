import { create } from 'zustand'

interface ZoomState {
  pixelsPerSecond: number
  setPixelsPerSecond: (val: number) => void
}

export const useZoomStore = create<ZoomState>((set) => ({
  pixelsPerSecond: 10,
  setPixelsPerSecond: (val) => set({ pixelsPerSecond: val }),
}))
