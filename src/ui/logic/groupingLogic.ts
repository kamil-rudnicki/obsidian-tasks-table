import { compareValues, priorityRanks, statusRanks } from '@shared/taskOrder'
import {
  getInlineFieldKey,
  getTaskLevel,
  type BuiltInGroupField,
  type Task,
  type TaskGroupField,
  type TaskGrouping,
} from '@shared/taskTypes'
import { formatTaskDate, getDisplayValue } from '@/logic/taskDisplayLogic'
import {
  columnLabels,
  filterLabels,
  getSortDirectionLabels,
  levelLabels,
  priorityLabels,
  statusLabels,
} from '@/logic/taskLabels'

// The hidden columns the table groups its rows by, one per level.
export const groupColumnIds = ['group', 'subgroup'] as const

export const isGroupColumnId = (columnId: string): boolean => (groupColumnIds as readonly string[]).includes(columnId)

// The id TanStack gives a group's row: its value at each level, such as `group:todo>subgroup:high`.
export const getGroupRowId = (keys: string[]): string =>
  keys.map((key, level) => `${groupColumnIds[level]}:${key}`).join('>')

const getGroupRowLevels = (id: string): number => (id.includes(`>${groupColumnIds[1]}:`) ? 2 : 1)

// The value a task is grouped by, or '' when it has none.
export const getGroupKey = (task: Task, field: TaskGroupField): string => {
  const fieldKey = getInlineFieldKey(field)
  if (fieldKey !== null) {
    return (task.fields[fieldKey] ?? '').trim()
  }
  switch (field as BuiltInGroupField) {
    case 'status':
      return task.status
    case 'priority':
      return task.priority
    case 'level':
      return getTaskLevel(task)
    // Notes with the same name in two folders are two groups.
    case 'note':
      return task.filePath
    case 'tags':
      return task.tags.join(' ')
    case 'folder':
      return task.folder
    default:
      return task[field as 'dueDate'] ?? ''
  }
}

// Groups follow the order sorting uses, except Normal comes first for priority.
// Groups without a value go last.
const getOrderValue = (task: Task, field: TaskGroupField, key: string): string | number | null => {
  if (key === '') {
    return null
  }
  switch (field) {
    case 'status':
      return statusRanks[task.status]
    case 'priority':
      return priorityRanks[task.priority]
    case 'level':
      return task.level
    case 'note':
      return `${task.note}\u0000${task.filePath}`
    default:
      return key
  }
}

export type TaskGroup = { key: string; tasks: Task[] }

// Tasks keep the view's sort inside their group.
export const groupTasks = (tasks: Task[], { field, desc }: TaskGrouping): TaskGroup[] => {
  const groups = new Map<string, TaskGroup & { order: string | number | null }>()

  for (const task of tasks) {
    const key = getGroupKey(task, field)
    const group = groups.get(key)
    if (group) {
      group.tasks.push(task)
    } else {
      groups.set(key, { key, tasks: [task], order: getOrderValue(task, field, key) })
    }
  }

  return [...groups.values()]
    .sort((first, second) => {
      if (field === 'priority' && (first.key === 'normal' || second.key === 'normal')) {
        return first.key === second.key ? 0 : first.key === 'normal' ? -1 : 1
      }
      if (first.order === null || second.order === null) {
        return first.order === second.order ? 0 : first.order === null ? 1 : -1
      }
      const result = compareValues(first.order, second.order)
      return desc ? -result : result
    })
    .map(({ key, tasks: groupTasks }) => ({ key, tasks: groupTasks }))
}

export type NestedTaskGroup = { id: string; tasks: Task[]; subgroups: NestedTaskGroup[] }

// Groups for the first level, each with its groups for the next level.
export const nestGroups = (tasks: Task[], groupings: TaskGrouping[], parentKeys: string[] = []): NestedTaskGroup[] => {
  const [grouping, ...nextGroupings] = groupings
  if (!grouping) {
    return []
  }
  return groupTasks(tasks, grouping).map((group) => {
    const keys = [...parentKeys, group.key]
    return { id: getGroupRowId(keys), tasks: group.tasks, subgroups: nestGroups(group.tasks, nextGroupings, keys) }
  })
}

// TanStack lists groups in the order their first rows come, so the rows go in group order.
export const getGroupedOrder = (groups: NestedTaskGroup[]): Task[] =>
  groups.flatMap((group) => (group.subgroups.length > 0 ? getGroupedOrder(group.subgroups) : group.tasks))

export const getGroupRowIds = (groups: NestedTaskGroup[]): string[] =>
  groups.flatMap((group) => [group.id, ...getGroupRowIds(group.subgroups)])

// TanStack's expanded state: every group is open except the collapsed ones.
export const getExpandedGroups = (ids: string[], collapsed: string[]): Record<string, boolean> =>
  Object.fromEntries(ids.map((id) => [id, !collapsed.includes(id)]))

// The collapsed groups after an expand or collapse. Groups that the filters
// hide at the moment keep their state for when they come back.
export const getCollapsedGroups = (
  expanded: boolean | Record<string, boolean>,
  ids: string[],
  previous: string[],
): string[] => {
  const hidden = previous.filter((id) => !ids.includes(id) && id.startsWith(`${groupColumnIds[0]}:`))
  if (typeof expanded === 'boolean') {
    return expanded ? hidden : [...hidden, ...ids]
  }
  return [...hidden, ...ids.filter((id) => !expanded[id])]
}

// The collapsed groups that still mean the same after the grouping changes:
// those of the levels that kept their property.
export const keepCollapsedGroups = (
  collapsed: string[],
  previous: TaskGrouping[],
  next: TaskGrouping[],
): string[] => {
  let sameLevels = 0
  while (sameLevels < Math.min(previous.length, next.length) && previous[sameLevels].field === next[sameLevels].field) {
    sameLevels += 1
  }
  return collapsed.filter((id) => getGroupRowLevels(id) <= sameLevels)
}

export const getGroupFieldLabel = (field: TaskGroupField): string =>
  getInlineFieldKey(field) ?? filterLabels[field as BuiltInGroupField]

export const getGroupDirectionLabels = (field: TaskGroupField): { asc: string; desc: string } =>
  field === 'level'
    ? { asc: 'First level → Subtasks', desc: 'Subtasks → First level' }
    : getSortDirectionLabels(field)

const groupDateFields = new Set<TaskGroupField>(['dueDate', 'scheduledDate', 'startDate', 'createdDate', 'doneDate'])

// The group's name as the table shows it. `task` is any task in the group.
export const getGroupLabel = (field: TaskGroupField, key: string, task: Task, today: string): string => {
  if (groupDateFields.has(field)) {
    const label = columnLabels[field as 'dueDate'].toLocaleLowerCase()
    return key === '' ? `No ${label} date` : formatTaskDate(key, today)
  }
  switch (field) {
    case 'status':
      return statusLabels[task.status]
    case 'priority':
      return priorityLabels[task.priority]
    case 'level':
      return levelLabels[getTaskLevel(task)]
    case 'note':
      return task.note
    case 'tags':
      return key === '' ? 'No tags' : task.tags.map((tag) => `#${tag}`).join(' ')
    case 'folder':
      return key === '' ? 'Vault root' : key
    default:
      return key === '' ? 'Empty' : getDisplayValue(key)
  }
}
