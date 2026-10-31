import { useMemo } from 'react'
import { ListFilterIcon, LoaderCircleIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { Settings } from '@shared/settingsTypes'
import type { View } from '@shared/viewTypes'
import { Filters } from '@/components/reui/filters'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { syncStatusQueryOptions } from '@/lib/queries'
import { toTaskFilters } from '@/logic/filterLogic'
import { describeSyncStatus, formatResultCount } from '@/logic/syncStatusLogic'
import { updateViewConfig } from '@/logic/viewActions'
import { createFilterFields, filterI18n } from './filterFields'
import { GroupMenu } from './GroupMenu'
import { MoreMenu } from './MoreMenu'
import { NewTaskButton } from './NewTaskButton'
import { PropertiesMenu } from './PropertiesMenu'
import { SearchToggle } from './SearchToggle'
import { SortMenu } from './SortMenu'
import { ToolbarLabel } from './ToolbarLabel'
import { toolbarButtonClassName } from './toolbarButtonClassName'
import { ViewSwitcher } from './ViewSwitcher'

type TasksToolbarProps = {
  views: View[]
  view: View
  settings: Settings
  resultCount: number | null
  fieldKeys: string[]
}

const IndexingIndicator = () => {
  const { data: status } = useQuery(syncStatusQueryOptions)

  if (status?.state !== 'indexing' && status?.state !== 'starting') {
    return null
  }

  return (
    <Tooltip>
      <TooltipTrigger render={<span role='status' className='flex size-7 items-center justify-center' />}>
        <LoaderCircleIcon aria-hidden='true' className='size-3.5 animate-spin text-muted-foreground' />
        <span className='sr-only'>{describeSyncStatus(status)}</span>
      </TooltipTrigger>
      <TooltipContent>{describeSyncStatus(status)}</TooltipContent>
    </Tooltip>
  )
}

// One row like the Bases toolbar. Filter chips wrap onto a second row: the
// reui Filters root uses `display: contents`, so its trigger sits in the
// toolbar and its chips take `order-2`, after a full-width break.
export const TasksToolbar = ({ views, view, settings, resultCount, fieldKeys }: TasksToolbarProps) => {
  const { filters } = view.config
  const hasFilters = filters.length > 0
  const filterFields = useMemo(() => createFilterFields(fieldKeys), [fieldKeys])

  return (
    <div className='flex shrink-0 flex-wrap items-center gap-x-0.5 gap-y-2 px-3 py-2 [&>.contents>[data-slot=button-group]]:order-2'>
      <ViewSwitcher views={views} activeView={view} />
      {resultCount !== null ? (
        <span className='ms-1 text-sm whitespace-nowrap text-muted-foreground tabular-nums'>
          {formatResultCount(resultCount)}
        </span>
      ) : null}
      <IndexingIndicator />
      <div className='min-w-2 flex-1' />
      <SortMenu view={view} fieldKeys={fieldKeys} />
      <GroupMenu view={view} fieldKeys={fieldKeys} />
      <Filters
        className='contents'
        filters={filters}
        fields={filterFields}
        i18n={filterI18n}
        onChange={(next) => updateViewConfig(view.id, { filters: toTaskFilters(next) })}
        size='sm'
        trigger={
          <Button
            variant='ghost'
            size='sm'
            data-active={hasFilters}
            className={toolbarButtonClassName}
          >
            <ListFilterIcon data-icon='inline-start' />
            <ToolbarLabel>Filter</ToolbarLabel>
          </Button>
        }
      />
      <PropertiesMenu />
      <SearchToggle />
      <NewTaskButton settings={settings} />
      <MoreMenu />
      {hasFilters ? <div aria-hidden='true' className='order-1 h-0 basis-full' /> : null}
    </div>
  )
}
