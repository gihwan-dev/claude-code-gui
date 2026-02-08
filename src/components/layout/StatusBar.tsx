import { Circle } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { useTranslation } from 'react-i18next'

export function StatusBar() {
  const { t } = useTranslation()

  return (
    <div className="flex h-6 shrink-0 items-center border-t bg-background px-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <Circle className="size-2 fill-muted-foreground" />
        <span>{t('statusBar.noSession')}</span>
      </div>

      <Separator orientation="vertical" className="mx-2 h-3" />

      <span>{t('statusBar.tokens')}: 0</span>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5">
        <Circle className="size-2 fill-destructive text-destructive" />
        <span>{t('statusBar.disconnected')}</span>
      </div>
    </div>
  )
}
