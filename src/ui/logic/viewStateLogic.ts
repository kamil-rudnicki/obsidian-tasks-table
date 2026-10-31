import { createStore } from '@tanstack/react-store'
import type { TaskFilter } from '@shared/taskTypes'
import type { View } from '@shared/viewTypes'

// UI state that is not part of a saved view. Search is per session, like in Bases.
export type TasksViewState = {
  activeViewId: string | null
  search: string
  // The search field shows while it is open or holds text.
  searchOpen: boolean
  // Counts Mod+F presses, so each one focuses the field, also when it is open.
  searchFocusRequest: number
}

export const tasksViewStore = createStore<TasksViewState>({
  activeViewId: null,
  search: '',
  searchOpen: false,
  searchFocusRequest: 0,
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

export const setSearchOpen = (searchOpen: boolean): void => {
  tasksViewStore.setState((state) => ({ ...state, searchOpen }))
}

export const focusSearch = (): void => {
  tasksViewStore.setState((state) => ({
    ...state,
    searchOpen: true,
    searchFocusRequest: state.searchFocusRequest + 1,
  }))
}
