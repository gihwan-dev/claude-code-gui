import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui-store'
import { WelcomeView } from '@/components/views/WelcomeView'
import { SessionsView } from '@/components/views/SessionsView'
import { ProjectsView } from '@/components/views/ProjectsView'

interface MainWindowContentProps {
  children?: React.ReactNode
  className?: string
}

function ActiveView() {
  const activeView = useUIStore(state => state.activeView)

  switch (activeView) {
    case 'sessions':
      return <SessionsView />
    case 'projects':
      return <ProjectsView />
    default:
      return <WelcomeView />
  }
}

export function MainWindowContent({
  children,
  className,
}: MainWindowContentProps) {
  return (
    <div className={cn('flex h-full flex-col bg-background', className)}>
      {children || <ActiveView />}
    </div>
  )
}
