import { vi } from 'vitest'

export class MockTerminal {
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

export class MockFitAddon {
  fit = vi.fn()
  dispose = vi.fn()
}

export function setupXtermMocks() {
  vi.mock('@xterm/xterm', () => ({
    Terminal: MockTerminal,
  }))

  vi.mock('@xterm/addon-fit', () => ({
    FitAddon: MockFitAddon,
  }))

  vi.mock('@xterm/addon-webgl', () => ({
    WebglAddon: vi.fn().mockImplementation(() => {
      throw new Error('WebGL not available')
    }),
  }))

  vi.mock('@/hooks/use-terminal-theme', () => ({
    useTerminalTheme: vi.fn().mockReturnValue({
      background: '#1a1a1a',
      foreground: '#e8eaed',
    }),
  }))
}
