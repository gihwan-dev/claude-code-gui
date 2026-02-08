import { render, screen } from '@/test/test-utils'
import { describe, it, expect } from 'vitest'
import { StatusBar } from './StatusBar'

describe('StatusBar', () => {
  it('renders session info', () => {
    render(<StatusBar />)
    expect(screen.getByText('No active session')).toBeInTheDocument()
  })

  it('renders token count', () => {
    render(<StatusBar />)
    expect(screen.getByText('Tokens: 0')).toBeInTheDocument()
  })

  it('renders disconnected status', () => {
    render(<StatusBar />)
    expect(screen.getByText('Disconnected')).toBeInTheDocument()
  })
})
