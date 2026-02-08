import { useSyncExternalStore } from 'react'
import type { ITheme } from '@xterm/xterm'
import { useTheme } from '@/hooks/use-theme'
import {
  terminalDarkTheme,
  terminalLightTheme,
} from '@/components/terminal/terminal-theme'

function subscribeToMediaQuery(callback: () => void): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', callback)
  return () => mq.removeEventListener('change', callback)
}

function getSystemIsDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function useTerminalTheme(): ITheme {
  const { theme } = useTheme()
  const systemIsDark = useSyncExternalStore(
    subscribeToMediaQuery,
    getSystemIsDark
  )

  const isDark = theme === 'dark' || (theme === 'system' && systemIsDark)

  return isDark ? terminalDarkTheme : terminalLightTheme
}
