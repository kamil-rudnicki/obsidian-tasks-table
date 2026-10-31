import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import type { TaskListQuery, TaskOptionsInput } from '@shared/taskTypes'
import { invoke } from '@/lib/api'

export const queryKeys = {
  tasks: ['tasks'] as const,
  taskLists: ['tasks', 'list'] as const,
  taskList: (query: TaskListQuery) => ['tasks', 'list', query] as const,
  taskOptions: (input: TaskOptionsInput) => ['tasks', 'options', input] as const,
  // Under `tasks`, so it refreshes whenever tasks change.
  taskFields: ['tasks', 'fields'] as const,
  views: ['views'] as const,
  settings: ['settings'] as const,
  syncStatus: ['syncStatus'] as const,
}

export const taskListQueryOptions = (query: TaskListQuery) =>
  queryOptions({
    queryKey: queryKeys.taskList(query),
    queryFn: () => invoke('tasks:list', query),
    placeholderData: keepPreviousData,
  })

// The vault's tags that contain `search`, by name.
export const tagOptionsQueryOptions = (search: string) =>
  queryOptions({
    queryKey: queryKeys.taskOptions({ field: 'tags', search }),
    queryFn: () => invoke('tasks:options', { field: 'tags', search }),
    placeholderData: keepPreviousData,
  })

export const viewsQueryOptions = queryOptions({
  queryKey: queryKeys.views,
  queryFn: () => invoke('views:list', null),
})

export const settingsQueryOptions = queryOptions({
  queryKey: queryKeys.settings,
  queryFn: () => invoke('settings:get', null),
})

export const syncStatusQueryOptions = queryOptions({
  queryKey: queryKeys.syncStatus,
  queryFn: () => invoke('vault:status', null),
})

export const taskFieldsQueryOptions = queryOptions({
  queryKey: queryKeys.taskFields,
  queryFn: () => invoke('tasks:fields', null),
  placeholderData: keepPreviousData,
})
