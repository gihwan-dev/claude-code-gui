import { render, screen } from '@/test/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'
import { StatusBar } from './StatusBar'
import { useTerminalStore } from '@/store/terminal-store'

describe('StatusBar', () => {
  beforeEach(() => {
    useTerminalStore.setState({
      sessionId: null,
      connectionStatus: 'disconnected',
    })
  })

  it('renders no session when sessionId is null', () => {
    render(<StatusBar />)
    expect(screen.getByText('No active session')).toBeInTheDocument()
  })

  it('renders session label when sessionId exists', () => {
    useTerminalStore.setState({ sessionId: 'test-session' })
    render(<StatusBar />)
    expect(screen.getByText('Session')).toBeInTheDocument()
  })

  it('renders token count', () => {
    render(<StatusBar />)
    expect(screen.getByText('Tokens: 0')).toBeInTheDocument()
  })

  it('renders disconnected status by default', () => {
    render(<StatusBar />)
    expect(screen.getByText('Disconnected')).toBeInTheDocument()
  })

  it('renders connected status', () => {
    useTerminalStore.setState({
      connectionStatus: 'connected',
      sessionId: 'test',
    })
    render(<StatusBar />)
    expect(screen.getByText('Connected')).toBeInTheDocument()
  })

  it('renders connecting status', () => {
    useTerminalStore.setState({ connectionStatus: 'connecting' })
    render(<StatusBar />)
    expect(screen.getByText('Connecting...')).toBeInTheDocument()
  })

  it('renders error status', () => {
    useTerminalStore.setState({ connectionStatus: 'error' })
    render(<StatusBar />)
    expect(screen.getByText('Connection Error')).toBeInTheDocument()
  })
})
