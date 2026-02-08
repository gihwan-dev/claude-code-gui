import type { ComponentType } from 'react'
import { cn } from '@/lib/utils'
import { useUIStore, type AppView } from '@/store/ui-store'
import { WelcomeView } from '@/components/views/WelcomeView'
import { SessionsView } from '@/components/views/SessionsView'
import { ProjectsView } from '@/components/views/ProjectsView'

interface MainWindowContentProps {
  children?: React.ReactNode
  className?: string
}

const VIEW_MAP: Record<AppView, ComponentType> = {
  welcome: WelcomeView,
  sessions: SessionsView,
  projects: ProjectsView,
}

function ActiveView() {
  const activeView = useUIStore(state => state.activeView)
  const View = VIEW_MAP[activeView]
  return <View />
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
