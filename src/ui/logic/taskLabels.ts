import type { TaskColumnId } from '@shared/taskColumns'
import {
  getInlineFieldKey,
  type BuiltInFilterField,
  type BuiltInSortField,
  type DateBucket,
  type TaskPriority,
  type TaskLevel,
  type TaskSortField,
  type TaskStatus,
} from '@shared/taskTypes'

export const statusLabels: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
}

export const priorityLabels: Record<TaskPriority, string> = {
  highest: 'Highest',
  high: 'High',
  medium: 'Medium',
  normal: 'Normal',
  low: 'Low',
  lowest: 'Lowest',
}

export const columnLabels: Record<TaskColumnId, string> = {
  complete: 'Checkbox',
  description: 'Task',
  status: 'Status',
  priority: 'Priority',
  dueDate: 'Due',
  scheduledDate: 'Scheduled',
  startDate: 'Start',
  tags: 'Tags',
  links: 'Links',
  comments: 'Comments',
  note: 'Note',
  folder: 'Folder',
  createdDate: 'Created',
  doneDate: 'Completed',
  actions: 'Actions',
}

export const filterLabels: Record<BuiltInFilterField, string> = {
  description: 'Task',
  status: 'Status',
  priority: 'Priority',
  dueDate: 'Due',
  scheduledDate: 'Scheduled',
  startDate: 'Start',
  createdDate: 'Created',
  doneDate: 'Completed',
  tags: 'Tags',
  note: 'Note',
  folder: 'Folder',
  dailyNote: 'Daily note',
  level: 'Level',
}

// "Level is First level" keeps the tasks that are not inside another list item.
export const levelLabels: Record<TaskLevel, string> = {
  first: 'First level',
  subtask: 'Subtask',
}

// "Daily note is Any day" keeps tasks from daily notes; "is not" keeps the others.
// Tomorrow's note holds the tasks planned for it.
export const dailyNoteBucketLabels: Array<{ value: DateBucket; label: string }> = [
  { value: 'any', label: 'Any day' },
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'past', label: 'Before today' },
]

// Past dates mean "overdue" for plans and "earlier" for records.
export const getDateBucketLabels = (
  field: 'dueDate' | 'scheduledDate' | 'startDate' | 'createdDate' | 'doneDate',
): Array<{ value: DateBucket; label: string }> => {
  const isPlan = field === 'dueDate' || field === 'scheduledDate' || field === 'startDate'

  return isPlan
    ? [
        { value: 'past', label: 'Overdue' },
        { value: 'today', label: 'Today' },
        { value: 'tomorrow', label: 'Tomorrow' },
        { value: 'next_7_days', label: 'Next 7 days' },
        { value: 'future', label: 'Later' },
      ]
    : [
        { value: 'today', label: 'Today' },
        { value: 'yesterday', label: 'Yesterday' },
        { value: 'last_7_days', label: 'Last 7 days' },
        { value: 'last_30_days', label: 'Last 30 days' },
        { value: 'past', label: 'Before today' },
      ]
}

const sortFieldLabels: Record<BuiltInSortField, string> = {
  description: 'Task',
  status: 'Status',
  priority: 'Priority',
  dueDate: 'Due',
  scheduledDate: 'Scheduled',
  startDate: 'Start',
  createdDate: 'Created',
  doneDate: 'Completed',
  tags: 'Tags',
  note: 'Note',
  folder: 'Folder',
}

// An inline field is named by its key, as Dataview shows it.
export const getSortFieldLabel = (field: TaskSortField): string =>
  getInlineFieldKey(field) ?? sortFieldLabels[field as BuiltInSortField]

const dateSortFields = new Set<TaskSortField>([
  'dueDate',
  'scheduledDate',
  'startDate',
  'createdDate',
  'doneDate',
])

// Directions read as the order rows appear in, like "A → Z" in Bases.
export const getSortDirectionLabels = (field: TaskSortField): { asc: string; desc: string } => {
  if (dateSortFields.has(field)) {
    return { asc: 'Old → New', desc: 'New → Old' }
  }
  switch (field) {
    case 'priority':
      return { asc: 'Low → High', desc: 'High → Low' }
    case 'status':
      return { asc: 'Open → Closed', desc: 'Closed → Open' }
    default:
      return { asc: 'A → Z', desc: 'Z → A' }
  }
}
