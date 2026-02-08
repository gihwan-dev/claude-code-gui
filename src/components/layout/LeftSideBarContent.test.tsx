import { render, screen } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '@/store/ui-store'
import { LeftSideBarContent } from './LeftSideBarContent'

describe('LeftSideBarContent', () => {
  beforeEach(() => {
    useUIStore.setState({ activeView: 'welcome' })
  })

  it('renders sidebar title', () => {
    render(<LeftSideBarContent />)
    expect(screen.getByText('Claude Code GUI')).toBeInTheDocument()
  })

  it('renders navigation items', () => {
    render(<LeftSideBarContent />)
    expect(screen.getByText('Sessions')).toBeInTheDocument()
    expect(screen.getByText('Projects')).toBeInTheDocument()
  })

  it('renders settings button', () => {
    render(<LeftSideBarContent />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('switches active view on nav click', async () => {
    const user = userEvent.setup()
    render(<LeftSideBarContent />)

    await user.click(screen.getByText('Sessions'))
    expect(useUIStore.getState().activeView).toBe('sessions')

    await user.click(screen.getByText('Projects'))
    expect(useUIStore.getState().activeView).toBe('projects')
  })

  it('highlights active nav item', () => {
    useUIStore.setState({ activeView: 'sessions' })
    render(<LeftSideBarContent />)

    const sessionsButton = screen.getByText('Sessions').closest('button')
    const projectsButton = screen.getByText('Projects').closest('button')

    expect(sessionsButton?.className).toContain('secondary')
    expect(projectsButton?.className).not.toContain('secondary')
  })
})
