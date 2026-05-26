import { create } from 'zustand'

interface SwapState {
  pending: { sourceBlockId: string; targetTrackId: string; dropAtSeconds: number } | null
  requestSwap: (req: NonNullable<SwapState['pending']>) => void
  cancelSwap: () => void
}

export const useSwapStore = create<SwapState>((set) => ({
  pending: null,
  requestSwap: (req) => set({ pending: req }),
  cancelSwap: () => set({ pending: null }),
}))
