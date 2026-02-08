import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import '@xterm/xterm/css/xterm.css'
import { usePtyConnection } from '@/hooks/use-pty-connection'
import { useTerminal } from '@/hooks/use-terminal'
import { useTerminalStore } from '@/store/terminal-store'

export function TerminalPanel() {
  const { t } = useTranslation()
  const isReady = useTerminalStore(state => state.isReady)
  const cols = useTerminalStore(state => state.cols)
  const rows = useTerminalStore(state => state.rows)
  const connectionStatus = useTerminalStore(state => state.connectionStatus)

  const { terminalRef, write, fit } = useTerminal({
    onData: data => {
      ptyWrite(data)
    },
  })

  const { isConnected, ptyWrite, ptyResize } = usePtyConnection({ write })

  // Sync terminal resize to PTY
  useEffect(() => {
    if (isConnected && cols > 0 && rows > 0) {
      ptyResize(cols, rows)
    }
  }, [cols, rows, isConnected, ptyResize])

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
