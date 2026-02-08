import { FolderGit2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function ProjectsView() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <FolderGit2 className="size-10 text-muted-foreground" />
      <h1 className="text-lg font-semibold">{t('views.projects.title')}</h1>
      <p className="text-sm text-muted-foreground">
        {t('views.projects.comingSoon')}
      </p>
    </div>
  )
}
