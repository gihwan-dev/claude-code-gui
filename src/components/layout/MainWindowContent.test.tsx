import { render, screen } from '@/test/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useUIStore } from '@/store/ui-store'
import { MainWindowContent } from './MainWindowContent'

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

describe('MainWindowContent', () => {
  beforeEach(() => {
    useUIStore.setState({ activeView: 'welcome' })
  })

  it('renders welcome view by default', () => {
    render(<MainWindowContent />)
    expect(screen.getByText('Welcome to Claude Code GUI')).toBeInTheDocument()
  })

  it('renders sessions view when active', () => {
    useUIStore.setState({ activeView: 'sessions' })
    render(<MainWindowContent />)
    expect(screen.getByText('Terminal')).toBeInTheDocument()
  })

  it('renders projects view when active', () => {
    useUIStore.setState({ activeView: 'projects' })
    render(<MainWindowContent />)
    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(
      screen.getByText('Project management coming soon')
    ).toBeInTheDocument()
  })

  it('renders children when provided', () => {
    render(
      <MainWindowContent>
        <div>Custom Content</div>
      </MainWindowContent>
    )
    expect(screen.getByText('Custom Content')).toBeInTheDocument()
  })
})
