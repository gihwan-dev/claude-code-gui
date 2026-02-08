import { useEffect, useRef } from 'react'
import type { ITheme } from '@xterm/xterm'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { useTerminalTheme } from '@/hooks/use-terminal-theme'
import { useTerminalStore } from '@/store/terminal-store'

interface UseTerminalOptions {
  minCols?: number
  maxCols?: number
  onData?: (data: string) => void
}

interface UseTerminalReturn {
  terminalRef: React.RefObject<HTMLDivElement | null>
  write: (data: string) => void
  fit: () => void
}

const FONT_FAMILY =
  "'Menlo', 'Monaco', 'Courier New', 'Lucida Console', monospace"

// Intentional no-op placeholder for refs before terminal initialization
function noop() {
  // no-op
}

function clampCols(cols: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, cols))
}

async function tryLoadWebGL(terminal: Terminal): Promise<boolean> {
  try {
    const { WebglAddon } = await import('@xterm/addon-webgl')
    const webglAddon = new WebglAddon()
    terminal.loadAddon(webglAddon)
    return true
  } catch {
    return false
  }
}

function createTerminal(theme: ITheme): Terminal {
  return new Terminal({
    theme,
    fontSize: 14,
    fontFamily: FONT_FAMILY,
    scrollback: 1000,
    cursorBlink: true,
    allowProposedApi: true,
  })
}

export function useTerminal(
  options: UseTerminalOptions = {}
): UseTerminalReturn {
  const { minCols = 80, maxCols = 120, onData } = options
  const terminalRef = useRef<HTMLDivElement | null>(null)
  const terminalInstanceRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const onDataRef = useRef(onData)

  const terminalTheme = useTerminalTheme()
  const themeRef = useRef(terminalTheme)

  const writeRef = useRef<(data: string) => void>(noop)
  const fitRef = useRef<() => void>(noop)

  // Keep refs in sync
  useEffect(() => {
    onDataRef.current = onData
  }, [onData])

  useEffect(() => {
    themeRef.current = terminalTheme
  }, [terminalTheme])

  useEffect(() => {
    const container = terminalRef.current
    if (!container) return

    const { setReady, setWebGLActive, setDimensions } =
      useTerminalStore.getState()

    const terminal = createTerminal(themeRef.current)

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    terminalInstanceRef.current = terminal
    fitAddonRef.current = fitAddon

    // Step 1: open (mount to DOM)
    terminal.open(container)

    // Step 2: initial fit
    fitAddon.fit()

    // Step 3: clamp columns
    const initialCols = clampCols(terminal.cols, minCols, maxCols)
    if (initialCols !== terminal.cols) {
      terminal.resize(initialCols, terminal.rows)
    }
    setDimensions(terminal.cols, terminal.rows)

    // Step 4: try WebGL (async)
    tryLoadWebGL(terminal).then(active => {
      setWebGLActive(active)
    })

    setReady(true)

    // Wire up write and fit refs
    writeRef.current = (data: string) => terminal.write(data)
    fitRef.current = () => {
      if (!container.offsetWidth || !container.offsetHeight) return
      fitAddon.fit()
      const clamped = clampCols(terminal.cols, minCols, maxCols)
      if (clamped !== terminal.cols) {
        terminal.resize(clamped, terminal.rows)
      }
      useTerminalStore.getState().setDimensions(terminal.cols, terminal.rows)
    }

    // Step 5: onData callback
    const dataDisposable = terminal.onData(data => {
      onDataRef.current?.(data)
    })

    // Step 6: ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        fitRef.current()
      })
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      dataDisposable.dispose()
      terminal.dispose()
      terminalInstanceRef.current = null
      fitAddonRef.current = null
      writeRef.current = noop
      fitRef.current = noop
      useTerminalStore.getState().setReady(false)
    }
  }, [minCols, maxCols])

  // Theme sync — update existing terminal without recreating
  useEffect(() => {
    const terminal = terminalInstanceRef.current
    if (terminal) {
      terminal.options.theme = terminalTheme
    }
  }, [terminalTheme])

  return {
    terminalRef,
    write: (data: string) => writeRef.current(data),
    fit: () => fitRef.current(),
  }
}
