import { describe, it, expect, beforeEach } from 'vitest'
import { useTerminalStore } from './terminal-store'

describe('terminal-store', () => {
  beforeEach(() => {
    useTerminalStore.setState({
      isReady: false,
      isWebGLActive: false,
      cols: 80,
      rows: 24,
      connectionStatus: 'disconnected',
    })
  })

  it('should have correct default values', () => {
    const state = useTerminalStore.getState()
    expect(state.isReady).toBe(false)
    expect(state.isWebGLActive).toBe(false)
    expect(state.cols).toBe(80)
    expect(state.rows).toBe(24)
    expect(state.connectionStatus).toBe('disconnected')
  })

  it('should set ready state', () => {
    useTerminalStore.getState().setReady(true)
    expect(useTerminalStore.getState().isReady).toBe(true)

    useTerminalStore.getState().setReady(false)
    expect(useTerminalStore.getState().isReady).toBe(false)
  })

  it('should set WebGL active state', () => {
    useTerminalStore.getState().setWebGLActive(true)
    expect(useTerminalStore.getState().isWebGLActive).toBe(true)

    useTerminalStore.getState().setWebGLActive(false)
    expect(useTerminalStore.getState().isWebGLActive).toBe(false)
  })

  it('should set dimensions', () => {
    useTerminalStore.getState().setDimensions(120, 40)
    const state = useTerminalStore.getState()
    expect(state.cols).toBe(120)
    expect(state.rows).toBe(40)
  })

  it('should set connection status', () => {
    useTerminalStore.getState().setConnectionStatus('connecting')
    expect(useTerminalStore.getState().connectionStatus).toBe('connecting')

    useTerminalStore.getState().setConnectionStatus('connected')
    expect(useTerminalStore.getState().connectionStatus).toBe('connected')

    useTerminalStore.getState().setConnectionStatus('disconnected')
    expect(useTerminalStore.getState().connectionStatus).toBe('disconnected')
  })
})
