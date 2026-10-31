import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from '@tanstack/react-store'
import type { Settings } from '@shared/settingsTypes'
import type { View } from '@shared/viewTypes'
import { DeleteTaskDialog } from '@/components/DeleteTaskDialog/DeleteTaskDialog'
import { TasksTable } from '@/components/TasksTable/TasksTable'
import { TasksToolbar } from '@/components/TasksToolbar/TasksToolbar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ViewNameDialog } from '@/components/ViewNameDialog/ViewNameDialog'
import {
  settingsQueryOptions,
  syncStatusQueryOptions,
  taskFieldsQueryOptions,
  taskListQueryOptions,
  viewsQueryOptions,
} from '@/lib/queries'
import { updateViewConfig } from '@/logic/viewActions'
import {
  getActiveFilters,
  resolveActiveView,
  setSearch,
  tasksViewStore,
} from '@/logic/viewStateLogic'

const PageSkeleton = () => (
  <div className='flex flex-col gap-3 p-3' aria-busy='true'>
    <div className='flex items-center gap-2'>
      <Skeleton className='h-7 w-32' />
      <Skeleton className='ms-auto h-7 w-72' />
    </div>
    {Array.from({ length: 10 }, (_, index) => (
      <Skeleton key={index} className='h-6 w-full' />
    ))}
  </div>
)

type WorkspaceProps = {
  views: View[]
  view: View
  settings: Settings
}

const TasksWorkspace = ({ views, view, settings }: WorkspaceProps) => {
  const search = useSelector(tasksViewStore, (state) => state.search)
  const activeFilters = getActiveFilters(view.config.filters)
  const tasksQuery = useQuery(
    taskListQueryOptions({ filters: activeFilters, sorting: view.config.sorting, search }),
  )
  const { data: syncStatus } = useQuery(syncStatusQueryOptions)
  const { data: fields } = useQuery(taskFieldsQueryOptions)
  // Stable between renders, so the table rebuilds its columns only when field names change.
  const fieldKeysKey = (fields ?? []).map((field) => field.key).join('\u0000')
  const fieldKeys = useMemo(() => (fieldKeysKey === '' ? [] : fieldKeysKey.split('\u0000')), [fieldKeysKey])
  const tasks = tasksQuery.data ?? []
  const isFirstIndex =
    (syncStatus?.state === 'indexing' || syncStatus?.state === 'starting') && syncStatus.taskCount === 0
  const isNarrowed = activeFilters.length > 0 || search.trim() !== ''

  const emptyMessage = isNarrowed ? (
    <div className='flex flex-col items-center gap-2 py-6'>
      <span>No tasks match this view.</span>
      <Button
        variant='outline'
        size='sm'
        onClick={() => {
          setSearch('')
          updateViewConfig(view.id, { filters: [] })
        }}
      >
        Show all tasks
      </Button>
    </div>
  ) : (
    <div className='py-6'>No tasks yet. Select New or write “- [ ] task” in any note.</div>
  )

  return (
    <TasksTable
      view={view}
      tasks={tasks}
      fieldKeys={fieldKeys}
      isLoading={tasksQuery.isPending || (isFirstIndex && tasks.length === 0)}
      emptyMessage={emptyMessage}
      toolbar={
        <TasksToolbar
          views={views}
          view={view}
          settings={settings}
          resultCount={tasksQuery.data ? tasks.length : null}
          fieldKeys={fieldKeys}
        />
      }
    />
  )
}

export const TasksPage = () => {
  const settingsQuery = useQuery(settingsQueryOptions)
  const viewsQuery = useQuery(viewsQueryOptions)
  const activeViewId = useSelector(tasksViewStore, (state) => state.activeViewId)

  if (settingsQuery.isError || viewsQuery.isError) {
    return (
      <div role='alert' className='flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground'>
        The tasks table could not load its database. Reload Obsidian and try again.
      </div>
    )
  }

  if (settingsQuery.isPending || viewsQuery.isPending) {
    return <PageSkeleton />
  }

  const views = viewsQuery.data
  const view = resolveActiveView(views, activeViewId)

  return (
    <div className='@container/tasks flex h-full min-h-0 flex-col bg-background text-sm text-foreground'>
      {view ? (
        <TasksWorkspace key={view.id} views={views} view={view} settings={settingsQuery.data} />
      ) : null}
      <ViewNameDialog />
      <DeleteTaskDialog />
    </div>
  )
}
