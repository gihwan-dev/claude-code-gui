import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { setupXtermMocks } from '@/test/__mocks__/xterm'
import { useTerminalStore } from '@/store/terminal-store'

setupXtermMocks()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'terminal.title': 'Terminal',
        'terminal.initializing': 'Initializing...',
        'terminal.connecting': 'Connecting...',
        'terminal.connected': 'Connected',
        'terminal.disconnected': 'Disconnected',
        'terminal.error': 'Connection Error',
      }
      if (key === 'terminal.dimensions' && params) {
        return `${params.cols}\u00d7${params.rows}`
      }
      return map[key] ?? key
    },
  }),
}))

vi.mock('@/hooks/use-pty', () => ({
  usePty: () => ({
    sessionId: null,
    isConnected: false,
    spawn: vi.fn().mockResolvedValue(undefined),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn().mockResolvedValue(undefined),
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
      sessionId: null,
      connectionStatus: 'disconnected',
    })
  })

  it('should render the terminal header with title', async () => {
    const { TerminalPanel } = await import('./TerminalPanel')
    render(<TerminalPanel />)
    expect(screen.getByText('Terminal')).toBeInTheDocument()
  })

  it('should show disconnected status when not connected', async () => {
    useTerminalStore.setState({ isReady: true })
    const { TerminalPanel } = await import('./TerminalPanel')
    render(<TerminalPanel />)
    expect(screen.getByText('Disconnected')).toBeInTheDocument()
  })

  it('should render the terminal container', async () => {
    const { TerminalPanel } = await import('./TerminalPanel')
    const { container } = render(<TerminalPanel />)
    const terminalContainer = container.querySelector('.terminal-container')
    expect(terminalContainer).toBeInTheDocument()
  })
})
