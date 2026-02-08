import { useCallback, useEffect, useRef } from 'react'
import { Channel } from '@tauri-apps/api/core'
import { commands } from '@/lib/tauri-bindings'
import type { PtyEvent, SpawnOptions } from '@/lib/tauri-bindings'
import { useTerminalStore } from '@/store/terminal-store'

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

    setConnectionStatus('connecting')

    const channel = new Channel<PtyEvent>()
    channel.onmessage = event => {
      if (event.event === 'Output') {
        onDataRef.current?.(new Uint8Array(event.data.data))
      } else if (event.event === 'Exit') {
        setConnectionStatus('disconnected')
        setSessionId(null)
        sessionIdRef.current = null
        onExitRef.current?.(event.data.code)
      } else if (event.event === 'Error') {
        setConnectionStatus('error')
      }
    }

    const result = await commands.ptySpawn(channel, spawnOptions)
    if (result.status === 'ok') {
      sessionIdRef.current = result.data
      setSessionId(result.data)
      setConnectionStatus('connected')
    } else {
      setConnectionStatus('error')
    }
  }, [])

  const write = useCallback((data: string) => {
    const id = sessionIdRef.current
    if (!id) return

    const encoder = new TextEncoder()
    const bytes = Array.from(encoder.encode(data))
    commands.ptyWrite(id, bytes).then(result => {
      if (result.status === 'error') {
        console.error('[pty] write failed:', result.error)
      }
    })
  }, [])

  const resize = useCallback((cols: number, rows: number) => {
    const id = sessionIdRef.current
    if (!id) return

    commands.ptyResize(id, cols, rows).then(result => {
      if (result.status === 'error') {
        console.error('[pty] resize failed:', result.error)
      }
    })
  }, [])

  const kill = useCallback(async () => {
    const id = sessionIdRef.current
    if (!id) return

    const result = await commands.ptyKill(id)
    if (result.status === 'error') {
      console.error('[pty] kill failed:', result.error)
    }
    sessionIdRef.current = null
    const { setSessionId, setConnectionStatus } = useTerminalStore.getState()
    setSessionId(null)
    setConnectionStatus('disconnected')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const id = sessionIdRef.current
      if (id) {
        commands.ptyKill(id)
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
