import { useCallback, useEffect, useRef } from 'react'
import { Channel } from '@tauri-apps/api/core'
import { commands } from '@/lib/tauri-bindings'
import type { PtyEvent, SpawnOptions } from '@/lib/tauri-bindings'
import { debug, error as logError } from '@/lib/logger'
import { useTerminalStore } from '@/store/terminal-store'

const encoder = new TextEncoder()

interface UsePtyOptions {
  onData?: (data: Uint8Array) => void
  onExit?: (code: number | null) => void
}

interface UsePtyReturn {
  sessionId: string | null
  isConnected: boolean
  spawn: (options: SpawnOptions) => Promise<void>
  write: (data: string) => void
  resize: (cols: number, rows: number) => void
  kill: () => Promise<void>
}

export function usePty(options: UsePtyOptions = {}): UsePtyReturn {
  const sessionIdRef = useRef<string | null>(null)
  const channelRef = useRef<Channel<PtyEvent> | null>(null)
  const exitedRef = useRef(false)
  const onDataRef = useRef(options.onData)
  const onExitRef = useRef(options.onExit)

  const sessionId = useTerminalStore(state => state.sessionId)
  const connectionStatus = useTerminalStore(state => state.connectionStatus)

  useEffect(() => {
    onDataRef.current = options.onData
  }, [options.onData])

  useEffect(() => {
    onExitRef.current = options.onExit
  }, [options.onExit])

  const spawn = useCallback(async (spawnOptions: SpawnOptions) => {
    const { setSessionId, setConnectionStatus } = useTerminalStore.getState()

    exitedRef.current = false
    setConnectionStatus('connecting')

    const channel = new Channel<PtyEvent>()
    channelRef.current = channel
    channel.onmessage = event => {
      debug(
        `[pty] channel event: ${event.event}`,
        event.event === 'Output'
          ? { bytes: event.data.data.length }
          : { data: event.data }
      )
      if (event.event === 'Output') {
        onDataRef.current?.(new Uint8Array(event.data.data))
      } else if (event.event === 'Exit') {
        exitedRef.current = true
        setConnectionStatus('disconnected')
        setSessionId(null)
        sessionIdRef.current = null
        channelRef.current = null
        onExitRef.current?.(event.data.code)
      } else if (event.event === 'Error') {
        setConnectionStatus('error')
      }
    }

    const result = await commands.ptySpawn(channel, spawnOptions)
    if (result.status === 'ok') {
      // Guard against race condition: if Exit event arrived during await,
      // don't overwrite 'disconnected' status back to 'connected'
      if (exitedRef.current) {
        return
      }
      sessionIdRef.current = result.data
      setSessionId(result.data)
      setConnectionStatus('connected')
    } else {
      setConnectionStatus('error')
    }
  }, [])

  const handleSessionLost = useCallback(() => {
    sessionIdRef.current = null
    const { setSessionId, setConnectionStatus } = useTerminalStore.getState()
    setSessionId(null)
    setConnectionStatus('disconnected')
  }, [])

  const write = useCallback(
    (data: string) => {
      const id = sessionIdRef.current
      if (!id) return

      const bytes = Array.from(encoder.encode(data))
      commands.ptyWrite(id, bytes).then(result => {
        if (result.status === 'error') {
          if (result.error.type === 'SessionNotFound') {
            handleSessionLost()
          }
          logError('[pty] write failed', { error: result.error })
        }
      })
    },
    [handleSessionLost]
  )

  const resize = useCallback(
    (cols: number, rows: number) => {
      const id = sessionIdRef.current
      if (!id) return

      commands.ptyResize(id, cols, rows).then(result => {
        if (result.status === 'error') {
          if (result.error.type === 'SessionNotFound') {
            handleSessionLost()
          }
          logError('[pty] resize failed', { error: result.error })
        }
      })
    },
    [handleSessionLost]
  )

  const kill = useCallback(async () => {
    const id = sessionIdRef.current
    if (!id) return

    const result = await commands.ptyKill(id)
    if (result.status === 'error') {
      logError('[pty] kill failed', { error: result.error })
    }
    // kill 실패 여부와 무관하게 로컬 상태 정리 (이미 죽은 세션 kill 시도 등)
    handleSessionLost()
  }, [handleSessionLost])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const id = sessionIdRef.current
      if (id) {
        sessionIdRef.current = null
        commands.ptyKill(id).catch(() => {
          // Ignore errors during cleanup — session may already be dead
        })
      }
    }
  }, [])

  return {
    sessionId,
    isConnected: connectionStatus === 'connected',
    spawn,
    write,
    resize,
    kill,
  }
}
