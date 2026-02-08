import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import '@xterm/xterm/css/xterm.css'
import { usePty } from '@/hooks/use-pty'
import { useTerminal } from '@/hooks/use-terminal'
import { debug } from '@/lib/logger'
import { useTerminalStore } from '@/store/terminal-store'

export function TerminalPanel() {
  const { t } = useTranslation()
  const isReady = useTerminalStore(state => state.isReady)
  const cols = useTerminalStore(state => state.cols)
  const rows = useTerminalStore(state => state.rows)
  const connectionStatus = useTerminalStore(state => state.connectionStatus)

  const writeRef = useRef<((data: string) => void) | null>(null)
  const pendingOutputRef = useRef<string[]>([])
  const decoderRef = useRef(new TextDecoder('utf-8', { fatal: false }))

  // Auto-spawn PTY when terminal is ready
  const spawnedRef = useRef(false)

  const {
    isConnected,
    spawn: ptySpawn,
    write: ptyWrite,
    resize: ptyResize,
  } = usePty({
    onData: data => {
      const decoded = decoderRef.current.decode(data, { stream: true })
      debug('[terminal] PTY output', {
        chars: decoded.length,
        writeReady: !!writeRef.current,
      })
      if (writeRef.current) {
        writeRef.current(decoded)
      } else {
        pendingOutputRef.current.push(decoded)
      }
    },
    onExit: () => {
      spawnedRef.current = false
      pendingOutputRef.current = []
      // Reset decoder state for next session
      decoderRef.current = new TextDecoder('utf-8', { fatal: false })
    },
  })

  const { terminalRef, write, fit } = useTerminal({
    onData: data => {
      ptyWrite(data)
    },
  })

  useEffect(() => {
    writeRef.current = write
    // Flush any output that arrived before terminal was ready
    if (write && pendingOutputRef.current.length > 0) {
      const pending = pendingOutputRef.current.join('')
      pendingOutputRef.current = []
      write(pending)
    }
  }, [write])

  // Sync terminal resize to PTY
  useEffect(() => {
    if (isConnected && cols > 0 && rows > 0) {
      ptyResize(cols, rows)
    }
  }, [cols, rows, isConnected, ptyResize])

  useEffect(() => {
    if (isReady && !spawnedRef.current) {
      spawnedRef.current = true
      ptySpawn({
        command: null,
        args: [],
        cwd: null,
        env: {},
        cols,
        rows,
      }).catch(() => {
        spawnedRef.current = false
      })
    }
  }, [isReady, cols, rows, ptySpawn])

  // Re-fit terminal on connection
  useEffect(() => {
    if (isConnected) {
      fit()
    }
  }, [isConnected, fit])

  const statusText = (() => {
    if (!isReady) return t('terminal.initializing')
    switch (connectionStatus) {
      case 'connecting':
        return t('terminal.connecting')
      case 'connected':
        return t('terminal.dimensions', { cols, rows })
      case 'error':
        return t('terminal.error')
      case 'disconnected':
        return t('terminal.disconnected')
    }
  })()

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-sm font-medium">{t('terminal.title')}</span>
        <span className="text-xs text-muted-foreground">{statusText}</span>
      </div>
      <div ref={terminalRef} className="terminal-container flex-1" />
    </div>
  )
}
