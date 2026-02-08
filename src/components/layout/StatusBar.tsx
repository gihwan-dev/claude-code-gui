import { Circle } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { useTranslation } from 'react-i18next'
import { useTerminalStore } from '@/store/terminal-store'

const statusConfig = {
  connected: {
    className: 'fill-green-500 text-green-500',
    i18nKey: 'statusBar.connected',
  },
  connecting: {
    className: 'fill-yellow-500 text-yellow-500',
    i18nKey: 'statusBar.connecting',
  },
  disconnected: {
    className: 'fill-destructive text-destructive',
    i18nKey: 'statusBar.disconnected',
  },
  error: {
    className: 'fill-destructive text-destructive',
    i18nKey: 'statusBar.error',
  },
} as const

export function StatusBar() {
  const { t } = useTranslation()
  const connectionStatus = useTerminalStore(state => state.connectionStatus)
  const sessionId = useTerminalStore(state => state.sessionId)

  const config = statusConfig[connectionStatus]

  return (
    <div className="flex h-6 shrink-0 items-center border-t bg-background px-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <Circle className="size-2 fill-muted-foreground" />
        <span>
          {sessionId ? t('statusBar.session') : t('statusBar.noSession')}
        </span>
      </div>

      <Separator orientation="vertical" className="mx-2 h-3" />

      <span>{t('statusBar.tokens')}: 0</span>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5">
        <Circle className={`size-2 ${config.className}`} />
        <span>{t(config.i18nKey)}</span>
      </div>
    </div>
  )
}
