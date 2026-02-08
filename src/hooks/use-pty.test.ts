import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTerminalStore } from '@/store/terminal-store'

// Track the channel.onmessage handler so tests can simulate Rust events
let capturedOnMessage: ((event: unknown) => void) | null = null

// Mock @tauri-apps/api/core Channel as a real class (required for `new Channel()`)
vi.mock('@tauri-apps/api/core', () => {
  class MockChannel {
    private _onmessage: ((event: unknown) => void) | null = null

    set onmessage(handler: (event: unknown) => void) {
      this._onmessage = handler
      capturedOnMessage = handler
    }

    get onmessage(): ((event: unknown) => void) | null {
      return this._onmessage
    }
  }

  return { Channel: MockChannel }
})

// Mock Tauri commands
const mockPtySpawn = vi.fn()
const mockPtyWrite = vi.fn()
const mockPtyResize = vi.fn()
const mockPtyKill = vi.fn()

vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    ptySpawn: (...args: unknown[]) => mockPtySpawn(...args),
    ptyWrite: (...args: unknown[]) => mockPtyWrite(...args),
    ptyResize: (...args: unknown[]) => mockPtyResize(...args),
    ptyKill: (...args: unknown[]) => mockPtyKill(...args),
  },
}))

describe('usePty', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedOnMessage = null
    useTerminalStore.setState({
      isReady: false,
      isWebGLActive: false,
      cols: 80,
      rows: 24,
      sessionId: null,
      connectionStatus: 'disconnected',
    })
    mockPtySpawn.mockResolvedValue({ status: 'ok', data: 'test-session-id' })
    mockPtyWrite.mockResolvedValue({ status: 'ok', data: null })
    mockPtyResize.mockResolvedValue({ status: 'ok', data: null })
    mockPtyKill.mockResolvedValue({ status: 'ok', data: null })
  })

  async function importAndRender(options = {}) {
    const { usePty } = await import('./use-pty')
    return renderHook(() => usePty(options))
  }

  /** Sends a simulated event from the Rust side through the captured Channel */
  function sendChannelEvent(event: unknown) {
    if (capturedOnMessage === null) {
      throw new Error(
        'Channel onmessage not set — spawn may not have been called'
      )
    }
    capturedOnMessage(event)
  }

  // ===== User Scenario: spawn → connected flow =====

  it('should transition to connected after successful spawn', async () => {
    const { result } = await importAndRender()

    await act(async () => {
      await result.current.spawn({
        command: null,
        args: [],
        cwd: null,
        env: {},
        cols: 99,
        rows: 57,
      })
    })

    expect(result.current.isConnected).toBe(true)
    expect(result.current.sessionId).toBe('test-session-id')
    expect(useTerminalStore.getState().connectionStatus).toBe('connected')
  })

  it('should transition to error when spawn fails', async () => {
    mockPtySpawn.mockResolvedValue({
      status: 'error',
      error: { type: 'SpawnError', message: 'test error' },
    })

    const { result } = await importAndRender()

    await act(async () => {
      await result.current.spawn({
        command: null,
        args: [],
        cwd: null,
        env: {},
        cols: 99,
        rows: 57,
      })
    })

    expect(result.current.isConnected).toBe(false)
    expect(useTerminalStore.getState().connectionStatus).toBe('error')
  })

  // ===== User Scenario: Channel receives Output events =====

  it('should call onData when Channel receives Output event', async () => {
    const onData = vi.fn()
    const { result } = await importAndRender({ onData })

    await act(async () => {
      await result.current.spawn({
        command: null,
        args: [],
        cwd: null,
        env: {},
        cols: 99,
        rows: 57,
      })
    })

    // Simulate Rust sending output through Channel
    expect(capturedOnMessage).not.toBeNull()
    act(() => {
      sendChannelEvent({
        event: 'Output',
        data: { data: [72, 101, 108, 108, 111] }, // "Hello"
      })
    })

    expect(onData).toHaveBeenCalledTimes(1)
    const firstCall = onData.mock.calls.at(0)
    if (!firstCall) throw new Error('onData was not called')
    const receivedData = firstCall[0] as Uint8Array
    expect(receivedData).toBeInstanceOf(Uint8Array)
    expect(Array.from(receivedData)).toEqual([72, 101, 108, 108, 111])
  })

  // ===== User Scenario: Shell exits → disconnected =====

  it('should transition to disconnected when Exit event received', async () => {
    const onExit = vi.fn()
    const { result } = await importAndRender({ onExit })

    await act(async () => {
      await result.current.spawn({
        command: null,
        args: [],
        cwd: null,
        env: {},
        cols: 99,
        rows: 57,
      })
    })

    expect(result.current.isConnected).toBe(true)

    // Simulate shell exit
    act(() => {
      sendChannelEvent({
        event: 'Exit',
        data: { code: null },
      })
    })

    expect(result.current.isConnected).toBe(false)
    expect(result.current.sessionId).toBeNull()
    expect(useTerminalStore.getState().connectionStatus).toBe('disconnected')
    expect(onExit).toHaveBeenCalledWith(null)
  })

  // ===== User Scenario: Multiple Output events before Exit =====

  it('should receive all Output events before Exit', async () => {
    const onData = vi.fn()
    const onExit = vi.fn()
    const { result } = await importAndRender({ onData, onExit })

    await act(async () => {
      await result.current.spawn({
        command: null,
        args: [],
        cwd: null,
        env: {},
        cols: 99,
        rows: 57,
      })
    })

    // Simulate multiple outputs then exit (like a shell that starts and immediately dies)
    act(() => {
      sendChannelEvent({
        event: 'Output',
        data: { data: [36, 32] }, // "$ "
      })
    })

    act(() => {
      sendChannelEvent({
        event: 'Exit',
        data: { code: 0 },
      })
    })

    expect(onData).toHaveBeenCalledTimes(1)
    expect(onExit).toHaveBeenCalledTimes(1)
    expect(result.current.isConnected).toBe(false)
  })

  // ===== User Scenario: write sends data correctly =====

  it('should encode and send data via ptyWrite', async () => {
    const { result } = await importAndRender()

    await act(async () => {
      await result.current.spawn({
        command: null,
        args: [],
        cwd: null,
        env: {},
        cols: 99,
        rows: 57,
      })
    })

    act(() => {
      result.current.write('ls\r')
    })

    // Wait for the async ptyWrite call
    await vi.waitFor(() => {
      expect(mockPtyWrite).toHaveBeenCalledTimes(1)
    })

    const writeCall = mockPtyWrite.mock.calls.at(0)
    if (!writeCall) throw new Error('ptyWrite was not called')
    const [sessionId, bytes] = writeCall
    expect(sessionId).toBe('test-session-id')
    // "ls\r" encoded as UTF-8
    expect(bytes).toEqual([108, 115, 13])
  })

  // ===== User Scenario: write does nothing when not connected =====

  it('should not call ptyWrite when no session exists', async () => {
    const { result } = await importAndRender()

    act(() => {
      result.current.write('test')
    })

    expect(mockPtyWrite).not.toHaveBeenCalled()
  })

  // ===== User Scenario: Channel set up BEFORE ptySpawn call =====

  it('should set up Channel onmessage before calling ptySpawn', async () => {
    let onmessageSetBeforeSpawn = false

    mockPtySpawn.mockImplementation(async () => {
      // At this point, the Channel onmessage should already be set
      onmessageSetBeforeSpawn = capturedOnMessage !== null
      return { status: 'ok', data: 'session-123' }
    })

    const { result } = await importAndRender()

    await act(async () => {
      await result.current.spawn({
        command: null,
        args: [],
        cwd: null,
        env: {},
        cols: 99,
        rows: 57,
      })
    })

    expect(onmessageSetBeforeSpawn).toBe(true)
  })

  // ===== User Scenario: Output events arriving during ptySpawn await =====

  it('should handle Output events arriving during ptySpawn await', async () => {
    const onData = vi.fn()

    mockPtySpawn.mockImplementation(async () => {
      // Simulate Rust sending output BEFORE ptySpawn resolves
      // (reader thread starts immediately after PTY spawn in Rust)
      if (capturedOnMessage) {
        capturedOnMessage({
          event: 'Output',
          data: { data: [37, 32] }, // "% "
        })
      }
      return { status: 'ok', data: 'session-early-data' }
    })

    const { result } = await importAndRender({ onData })

    await act(async () => {
      await result.current.spawn({
        command: null,
        args: [],
        cwd: null,
        env: {},
        cols: 99,
        rows: 57,
      })
    })

    // The output should have been received even though ptySpawn hadn't resolved yet
    expect(onData).toHaveBeenCalledTimes(1)
    expect(result.current.isConnected).toBe(true)
  })

  // ===== Rust JSON shape matching =====

  it('should correctly decode Output event matching Rust serde JSON shape', async () => {
    // Rust: PtyEvent::Output { data: vec![72,101,108,108,111] }
    // serde(tag="event", content="data") → {"event":"Output","data":{"data":[72,101,108,108,111]}}
    const onData = vi.fn()
    const { result } = await importAndRender({ onData })

    await act(async () => {
      await result.current.spawn({
        command: null,
        args: [],
        cwd: null,
        env: {},
        cols: 80,
        rows: 24,
      })
    })

    act(() => {
      sendChannelEvent({
        event: 'Output',
        data: { data: [72, 101, 108, 108, 111] },
      })
    })

    expect(onData).toHaveBeenCalledTimes(1)
    const firstCall = onData.mock.calls.at(0)
    if (!firstCall) throw new Error('onData was not called')
    const decoded = new TextDecoder().decode(firstCall[0])
    expect(decoded).toBe('Hello')
  })

  // ===== User Scenario: Exit event during ptySpawn await (race condition) =====

  it('should stay disconnected when Exit arrives during ptySpawn await', async () => {
    const onExit = vi.fn()

    mockPtySpawn.mockImplementation(async () => {
      // Simulate shell exiting immediately (before ptySpawn resolves)
      // This happens when the reader thread sends Exit before the IPC response
      if (capturedOnMessage) {
        capturedOnMessage({
          event: 'Exit',
          data: { code: 1 },
        })
      }
      return { status: 'ok', data: 'session-exits-early' }
    })

    const { result } = await importAndRender({ onExit })

    await act(async () => {
      await result.current.spawn({
        command: null,
        args: [],
        cwd: null,
        env: {},
        cols: 99,
        rows: 57,
      })
    })

    // Exit event should have been processed
    expect(onExit).toHaveBeenCalledWith(1)

    // CRITICAL: The final state must be 'disconnected', NOT 'connected'
    // The spawn success handler must NOT overwrite the Exit event's state change
    expect(useTerminalStore.getState().connectionStatus).toBe('disconnected')
    expect(result.current.isConnected).toBe(false)
    expect(result.current.sessionId).toBeNull()
  })
})
