import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { TasksPage } from '@/components/TasksPage/TasksPage'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PortalContainerContext } from '@/lib/portalContainer'
import { queryClient } from '@/lib/queryClient'

// Must match `scopeClassName` in scripts/scopeCss.mjs.
const scopeClassName = 'tasks-table-scope'

// Renders the tasks table into an Obsidian view. Popups go into a scoped
// element at the end of the view's window, so they also work in pop-out windows.
export const mountTasksApp = (host: HTMLElement): (() => void) => {
  const container = host.createDiv({ cls: [scopeClassName, 'tasks-table-mount'] })
  const portalContainer = host.ownerDocument.body.createDiv({ cls: [scopeClassName, 'tasks-table-portal'] })

  const root = createRoot(container)
  root.render(
    <StrictMode>
      <PortalContainerContext.Provider value={portalContainer}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delay={150}>
            <TasksPage />
          </TooltipProvider>
        </QueryClientProvider>
      </PortalContainerContext.Provider>
    </StrictMode>,
  )

  return () => {
    root.unmount()
    container.remove()
    portalContainer.remove()
  }
}
