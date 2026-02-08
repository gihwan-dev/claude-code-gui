import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import '@xterm/xterm/css/xterm.css'
import { useTerminal } from '@/hooks/use-terminal'
import { useTerminalStore } from '@/store/terminal-store'

export function TerminalPanel() {
  const { t } = useTranslation()
  const isReady = useTerminalStore(state => state.isReady)
  const cols = useTerminalStore(state => state.cols)
  const rows = useTerminalStore(state => state.rows)

  const lineBufferRef = useRef('')
  const writeRef = useRef<((data: string) => void) | null>(null)

  const handleData = useCallback((data: string) => {
    const writeFn = writeRef.current
    if (!writeFn) return

    for (const ch of data) {
      if (ch === '\r') {
        writeFn(`\r\n${lineBufferRef.current}\r\n`)
        lineBufferRef.current = ''
      } else if (ch === '\x7f' || ch === '\b') {
        if (lineBufferRef.current.length > 0) {
          lineBufferRef.current = lineBufferRef.current.slice(0, -1)
          writeFn('\b \b')
        }
      } else if (ch >= ' ') {
        lineBufferRef.current += ch
        writeFn(ch)
      }
    }
  }, [])

  const { terminalRef, write } = useTerminal({
    onData: handleData,
  })

  useEffect(() => {
    writeRef.current = write
  }, [write])

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
