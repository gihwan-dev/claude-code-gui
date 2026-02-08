import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { setupXtermMocks } from '@/test/__mocks__/xterm'
import { useTerminalStore } from '@/store/terminal-store'

setupXtermMocks()

describe('useTerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useTerminalStore.setState({
      isReady: false,
      isWebGLActive: false,
      cols: 80,
      rows: 24,
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
