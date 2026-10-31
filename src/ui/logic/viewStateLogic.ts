import { createStore } from '@tanstack/react-store'
import type { TaskFilter } from '@shared/taskTypes'
import type { View } from '@shared/viewTypes'

// UI state that is not part of a saved view. Search is per session, like in Bases.
export type TasksViewState = {
  activeViewId: string | null
  search: string
}

export const tasksViewStore = createStore<TasksViewState>({
  activeViewId: null,
  search: '',
})

const valuelessOperators = new Set(['empty', 'not_empty'])

// A filter chip without values does not filter anything yet.
export const getActiveFilters = (filters: TaskFilter[]): TaskFilter[] =>
  filters.filter(
    (filter) =>
      valuelessOperators.has(filter.operator) ||
      filter.values.some((value) => value !== null && String(value).trim() !== ''),
  )

export const resolveActiveView = (views: View[], activeViewId: string | null): View | null =>
  views.find((view) => view.id === activeViewId) ?? views[0] ?? null

export const setActiveViewId = (activeViewId: string | null): void => {
  tasksViewStore.setState((state) => ({ ...state, activeViewId }))
}

export const setSearch = (search: string): void => {
  tasksViewStore.setState((state) => ({ ...state, search }))
}
