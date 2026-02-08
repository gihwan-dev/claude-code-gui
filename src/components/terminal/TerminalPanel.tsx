import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import '@xterm/xterm/css/xterm.css'
import { useLineBuffer } from '@/hooks/use-line-buffer'
import { useTerminal } from '@/hooks/use-terminal'
import { useTerminalStore } from '@/store/terminal-store'

export function TerminalPanel() {
  const { t } = useTranslation()
  const isReady = useTerminalStore(state => state.isReady)
  const cols = useTerminalStore(state => state.cols)
  const rows = useTerminalStore(state => state.rows)

  const { handleData, setWrite } = useLineBuffer()

  const { terminalRef, write } = useTerminal({
    onData: handleData,
  })

  useEffect(() => {
    setWrite(write)
  }, [write, setWrite])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-sm font-medium">{t('terminal.title')}</span>
        <span className="text-xs text-muted-foreground">
          {isReady ? `${cols}\u00d7${rows}` : t('terminal.initializing')}
        </span>
      </div>
      <div ref={terminalRef} className="terminal-container flex-1" />
    </div>
  )
}
