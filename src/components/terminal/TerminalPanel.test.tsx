import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useTerminalStore } from '@/store/terminal-store'

vi.mock('@xterm/xterm', () => {
  class MockTerminal {
    cols = 80
    rows = 24
    options: Record<string, unknown> = {}
    open = vi.fn()
    dispose = vi.fn()
    write = vi.fn()
    resize = vi.fn()
    loadAddon = vi.fn()
    onData = vi.fn().mockReturnValue({ dispose: vi.fn() })
  }
  return { Terminal: MockTerminal }
})

vi.mock('@xterm/addon-fit', () => {
  class MockFitAddon {
    fit = vi.fn()
    dispose = vi.fn()
  }
  return { FitAddon: MockFitAddon }
})

vi.mock('@xterm/addon-webgl', () => {
  class MockWebglAddon {
    constructor() {
      throw new Error('WebGL not available')
    }
  }
  return { WebglAddon: MockWebglAddon }
})

vi.mock('@/hooks/use-terminal-theme', () => ({
  useTerminalTheme: vi.fn().mockReturnValue({
    background: '#1a1a1a',
    foreground: '#e8eaed',
  }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'terminal.title': 'Terminal',
        'terminal.initializing': 'Initializing...',
      }
      return map[key] ?? key
    },
  }),
}))

describe('TerminalPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useTerminalStore.setState({
      isReady: false,
      isWebGLActive: false,
      cols: 80,
      rows: 24,
      connectionStatus: 'disconnected',
    })
  })

  it('should render the terminal header with title', async () => {
    const { TerminalPanel } = await import('./TerminalPanel')
    render(<TerminalPanel />)
    expect(screen.getByText('Terminal')).toBeInTheDocument()
  })

  it('should show dimensions after terminal initializes', async () => {
    const { TerminalPanel } = await import('./TerminalPanel')
    render(<TerminalPanel />)
    // After useTerminal effect runs, store is set to ready with 80×24
    expect(screen.getByText('80\u00d724')).toBeInTheDocument()
  })

  it('should render the terminal container', async () => {
    const { TerminalPanel } = await import('./TerminalPanel')
    const { container } = render(<TerminalPanel />)
    const terminalContainer = container.querySelector('.terminal-container')
    expect(terminalContainer).toBeInTheDocument()
  })
})
