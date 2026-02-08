import { Terminal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function SessionsView() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <Terminal className="size-10 text-muted-foreground" />
      <h1 className="text-lg font-semibold">{t('views.sessions.title')}</h1>
      <p className="text-sm text-muted-foreground">
        {t('views.sessions.comingSoon')}
      </p>
    </div>
  )
}
