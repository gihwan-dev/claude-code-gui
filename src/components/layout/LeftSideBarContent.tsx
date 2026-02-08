import { Terminal, FolderGit2, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useUIStore, type AppView } from '@/store/ui-store'
import { executeCommand } from '@/lib/commands/registry'
import { useCommandContext } from '@/hooks/use-command-context'

interface NavItem {
  id: string
  view: AppView
  labelKey: string
  icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'sessions',
    view: 'sessions',
    labelKey: 'sidebar.sessions',
    icon: Terminal,
  },
  {
    id: 'projects',
    view: 'projects',
    labelKey: 'sidebar.projects',
    icon: FolderGit2,
  },
]

export function LeftSideBarContent() {
  const { t } = useTranslation()
  const activeView = useUIStore(state => state.activeView)
  const ctx = useCommandContext()

  const handleNavClick = (view: AppView) => {
    useUIStore.getState().setActiveView(view)
  }

  const handleSettingsClick = () => {
    executeCommand('open-preferences', ctx)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 items-center px-3">
        <span className="text-sm font-semibold">{t('sidebar.title')}</span>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 p-2">
          {NAV_ITEMS.map(item => (
            <Button
              key={item.id}
              variant={activeView === item.view ? 'secondary' : 'ghost'}
              size="sm"
              className="justify-start"
              onClick={() => handleNavClick(item.view)}
            >
              <item.icon className="size-4" />
              {t(item.labelKey)}
            </Button>
          ))}
        </div>
      </ScrollArea>

      <Separator />

      <div className="p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={handleSettingsClick}
        >
          <Settings className="size-4" />
          {t('sidebar.settings')}
        </Button>
      </div>
    </div>
  )
}
