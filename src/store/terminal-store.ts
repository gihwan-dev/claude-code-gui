import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface TerminalState {
  isReady: boolean
  isWebGLActive: boolean
  cols: number
  rows: number
  sessionId: string | null
  connectionStatus: ConnectionStatus

  setReady: (ready: boolean) => void
  setWebGLActive: (active: boolean) => void
  setDimensions: (cols: number, rows: number) => void
  setSessionId: (id: string | null) => void
  setConnectionStatus: (status: ConnectionStatus) => void
}

export const useTerminalStore = create<TerminalState>()(
  devtools(
    set => ({
      isReady: false,
      isWebGLActive: false,
      cols: 80,
      rows: 24,
      sessionId: null,
      connectionStatus: 'disconnected',

      setReady: ready => set({ isReady: ready }, undefined, 'setReady'),

      setWebGLActive: active =>
        set({ isWebGLActive: active }, undefined, 'setWebGLActive'),

      setDimensions: (cols, rows) =>
        set({ cols, rows }, undefined, 'setDimensions'),

      setSessionId: id => set({ sessionId: id }, undefined, 'setSessionId'),

      setConnectionStatus: status =>
        set({ connectionStatus: status }, undefined, 'setConnectionStatus'),
    }),
    {
      name: 'terminal-store',
    }
  )
)
