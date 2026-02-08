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
      }
      if (key === 'terminal.dimensions' && params) {
        return `${params.cols}\u00d7${params.rows}`
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
