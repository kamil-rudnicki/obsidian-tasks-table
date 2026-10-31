import type { QueryClient } from '@tanstack/react-query'
import { getPluginApi } from '@/lib/api'
import { queryKeys } from '@/lib/queries'
import { setNewTaskOpen } from '@/logic/newTaskLogic'

export const subscribeToAppEvents = (queryClient: QueryClient): (() => void) =>
  getPluginApi().onEvent((event) => {
    switch (event.type) {
      case 'tasks-changed':
        void queryClient.invalidateQueries({ queryKey: queryKeys.tasks })
        break
      case 'views-changed':
        void queryClient.invalidateQueries({ queryKey: queryKeys.views })
        break
      case 'settings-changed':
        void queryClient.invalidateQueries({ queryKey: queryKeys.settings })
        break
      case 'sync-status':
        queryClient.setQueryData(queryKeys.syncStatus, event.status)
        break
      case 'focus-new-task':
        setNewTaskOpen(true)
        break
    }
  })
