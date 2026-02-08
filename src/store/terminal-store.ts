import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface TerminalState {
  isReady: boolean
  isWebGLActive: boolean
  cols: number
  rows: number

  setReady: (ready: boolean) => void
  setWebGLActive: (active: boolean) => void
  setDimensions: (cols: number, rows: number) => void
}

export const useTerminalStore = create<TerminalState>()(
  devtools(
    set => ({
      isReady: false,
      isWebGLActive: false,
      cols: 80,
      rows: 24,

      setReady: ready => set({ isReady: ready }, undefined, 'setReady'),

      setWebGLActive: active =>
        set({ isWebGLActive: active }, undefined, 'setWebGLActive'),

      setDimensions: (cols, rows) =>
        set({ cols, rows }, undefined, 'setDimensions'),
    }),
    {
      name: 'terminal-store',
    }
  )
)
