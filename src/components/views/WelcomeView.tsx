import { Bot, Plus, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'

export function WelcomeView() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <Bot className="size-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold">{t('views.welcome.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('views.welcome.subtitle')}
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" disabled>
          <Plus className="size-4" />
          {t('views.welcome.newSession')}
        </Button>
        <Button variant="outline" disabled>
          <FolderOpen className="size-4" />
          {t('views.welcome.openProject')}
        </Button>
      </div>
    </div>
  )
}
