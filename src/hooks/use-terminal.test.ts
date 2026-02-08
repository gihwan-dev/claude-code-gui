import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTerminalStore } from '@/store/terminal-store'

vi.mock('@xterm/xterm', () => {
  class MockTerminal {
    cols = 80
    rows = 24
    options: Record<string, unknown> = {}
    open = vi.fn()
    dispose = vi.fn()
    write = vi.fn()
    resize = vi.fn()
    loadAddon = vi.fn()
    onData = vi.fn().mockReturnValue({ dispose: vi.fn() })
  }
  return { Terminal: MockTerminal }
})

vi.mock('@xterm/addon-fit', () => {
  class MockFitAddon {
    fit = vi.fn()
    dispose = vi.fn()
  }
  return { FitAddon: MockFitAddon }
})

vi.mock('@xterm/addon-webgl', () => {
  class MockWebglAddon {
    constructor() {
      throw new Error('WebGL not available')
    }
  }
  return { WebglAddon: MockWebglAddon }
})

vi.mock('@/hooks/use-terminal-theme', () => ({
  useTerminalTheme: vi.fn().mockReturnValue({
    background: '#1a1a1a',
    foreground: '#e8eaed',
  }),
}))

describe('useTerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useTerminalStore.setState({
      isReady: false,
      isWebGLActive: false,
      cols: 80,
      rows: 24,
      connectionStatus: 'disconnected',
    })
  })

  it('should expose write and fit functions', async () => {
    const { useTerminal } = await import('./use-terminal')

    const { result } = renderHook(() => useTerminal())

    expect(typeof result.current.write).toBe('function')
    expect(typeof result.current.fit).toBe('function')
  })

  it('should return a terminalRef', async () => {
    const { useTerminal } = await import('./use-terminal')

    const { result } = renderHook(() => useTerminal())

    expect(result.current.terminalRef).toBeDefined()
    expect(result.current.terminalRef.current).toBeNull()
  })

  it('should accept custom minCols and maxCols', async () => {
    const { useTerminal } = await import('./use-terminal')

    const { result } = renderHook(() =>
      useTerminal({ minCols: 60, maxCols: 200 })
    )

    expect(result.current.terminalRef).toBeDefined()
  })
})
