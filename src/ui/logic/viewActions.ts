import { createDefaultViewConfig } from '@shared/taskColumns'
import type { View, ViewConfig } from '@shared/viewTypes'
import { getPluginApi, invoke } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { queryKeys } from '@/lib/queries'
import { queryClient } from '@/lib/queryClient'
import { setActiveViewId, tasksViewStore } from '@/logic/viewStateLogic'

// Views save on their own shortly after each change, like Bases.
const saveDelayMs = 400
const activeViewKey = 'tasks-table-active-view'
const saveTimers = new Map<string, number>()

const getViews = (): View[] => queryClient.getQueryData<View[]>(queryKeys.views) ?? []

const setViews = (update: (views: View[]) => View[]): void => {
  queryClient.setQueryData<View[]>(queryKeys.views, (views) => update(views ?? []))
}

const run = async <Result>(action: () => Promise<Result>): Promise<Result | null> => {
  try {
    return await action()
  } catch (error) {
    notifyError(error)
    void queryClient.invalidateQueries({ queryKey: queryKeys.views })
    return null
  }
}

export const restoreActiveView = (): void => {
  const stored = getPluginApi().loadUiState(activeViewKey)
  setActiveViewId(typeof stored === 'string' ? stored : null)
}

export const selectView = (viewId: string): void => {
  setActiveViewId(viewId)
  getPluginApi().saveUiState(activeViewKey, viewId)
}

const saveSoon = (viewId: string): void => {
  window.clearTimeout(saveTimers.get(viewId))
  saveTimers.set(
    viewId,
    window.setTimeout(() => {
      saveTimers.delete(viewId)
      const view = getViews().find((item) => item.id === viewId)
      if (view) {
        void run(() => invoke('views:update', { id: view.id, config: view.config }))
      }
    }, saveDelayMs),
  )
}

// Shows the change at once and saves it shortly after.
export const updateViewConfig = (viewId: string, patch: Partial<ViewConfig>): void => {
  setViews((views) =>
    views.map((view) =>
      view.id === viewId ? { ...view, config: { ...view.config, ...patch } } : view,
    ),
  )
  saveSoon(viewId)
}

export const createView = (name: string, config: ViewConfig = createDefaultViewConfig()) =>
  run(async () => {
    const created = await invoke('views:create', { name, config })
    setViews((views) => [...views, created])
    selectView(created.id)
  })

export const duplicateView = (view: View, name: string) => createView(name, view.config)

export const renameView = (view: View, name: string) =>
  run(async () => {
    setViews((views) => views.map((item) => (item.id === view.id ? { ...item, name } : item)))
    await invoke('views:update', { id: view.id, name })
  })

export const deleteView = (view: View) =>
  run(async () => {
    const views = getViews()
    const index = views.findIndex((item) => item.id === view.id)
    window.clearTimeout(saveTimers.get(view.id))
    await invoke('views:delete', { id: view.id })
    const remaining = views.filter((item) => item.id !== view.id)
    setViews(() => remaining)
    const next = remaining[Math.min(index, remaining.length - 1)]
    if (next && tasksViewStore.state.activeViewId === view.id) {
      selectView(next.id)
    }
  })

// Saves pending view changes now, for example before the plugin unloads.
export const flushViewSaves = async (): Promise<void> => {
  const pending = [...saveTimers.keys()]
  for (const timer of saveTimers.values()) {
    window.clearTimeout(timer)
  }
  saveTimers.clear()

  await Promise.all(
    pending.map(async (viewId) => {
      const view = getViews().find((item) => item.id === viewId)
      if (view) {
        await invoke('views:update', { id: view.id, config: view.config }).catch(() => undefined)
      }
    }),
  )
}
