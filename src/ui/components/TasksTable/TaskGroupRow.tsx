import { ChevronRightIcon } from 'lucide-react'
import type { Row } from '@tanstack/react-table'
import { getToday } from '@shared/dateLogic'
import type { Task, TaskGroupField } from '@shared/taskTypes'
import type { DataGridFeatures } from '@/components/reui/data-grid/data-grid'
import { TagBadge } from '@/components/TagBadge/TagBadge'
import { TaskPriorityIcon } from '@/components/TaskCells/TaskPriorityIcon'
import { TaskStatusIcon } from '@/components/TaskCells/TaskStatusIcon'
import { cn } from '@/lib/utils'
import { getGroupFieldLabel, getGroupLabel } from '@/logic/groupingLogic'

type TaskGroupRowProps = {
  row: Row<DataGridFeatures, Task>
  field: TaskGroupField
}

// The group's value as its cells show it: icons for status and priority, pills for tags.
const GroupValue = ({ field, groupKey, task, label }: { field: TaskGroupField; groupKey: string; task: Task; label: string }) => {
  if (groupKey === '') {
    return <span className='text-muted-foreground'>{label}</span>
  }
  switch (field) {
    case 'status':
      return (
        <span className='flex items-center gap-1.5 font-medium'>
          <TaskStatusIcon status={task.status} className='size-3.5' />
          {label}
        </span>
      )
    case 'priority':
      return (
        <span className='flex items-center gap-1.5 font-medium'>
          <TaskPriorityIcon priority={task.priority} />
          {label}
        </span>
      )
    case 'tags':
      return (
        <span className='flex min-w-0 items-center gap-1 overflow-hidden'>
          {task.tags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </span>
      )
    default:
      return <span className='truncate font-medium'>{label}</span>
  }
}

// A group's header, like Bases: the property, its value and the number of tasks.
// Selecting it opens or closes the group.
export const TaskGroupRow = ({ row, field }: TaskGroupRowProps) => {
  const task = row.original
  // The group column's value: always text, '' for tasks without one.
  const groupKey = typeof row.groupingValue === 'string' ? row.groupingValue : ''
  const label = getGroupLabel(field, groupKey, task, getToday())
  const isExpanded = row.getIsExpanded()

  return (
    <button
      type='button'
      aria-expanded={isExpanded}
      onClick={() => row.toggleExpanded()}
      className='flex h-9 w-full min-w-0 cursor-default items-center gap-2 bg-muted px-2 text-start text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset'
    >
      <ChevronRightIcon
        aria-hidden='true'
        className={cn(
          'size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none',
          isExpanded && 'rotate-90',
        )}
      />
      <span className='shrink-0 text-muted-foreground'>{getGroupFieldLabel(field)}</span>
      <GroupValue field={field} groupKey={groupKey} task={task} label={label} />
      <span className='shrink-0 text-muted-foreground tabular-nums'>{row.subRows.length}</span>
    </button>
  )
}
