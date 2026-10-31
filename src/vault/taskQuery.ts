import { addDays } from '@shared/dateLogic'
import {
  dateBucketSchema,
  isoDateSchema,
  type DateBucket,
  type TaskDateField,
  type TaskFilter,
  type TaskFilterField,
  type TaskListQuery,
  type TaskPriority,
  getInlineFieldKey,
  getTaskLevel,
  type BuiltInSortField,
  type TaskSortField,
  type TaskStatus,
} from '@shared/taskTypes'
import type { IndexedTask } from './noteTasks'

export type TaskPredicate = (task: IndexedTask) => boolean
type TaskComparator = (first: IndexedTask, second: IndexedTask) => number

const fold = (value: string): string => value.toLocaleLowerCase()

const textFields: Partial<Record<TaskFilterField, 'description' | 'note' | 'folder'>> = {
  description: 'description',
  note: 'note',
  folder: 'folder',
}

const choiceFields: Partial<Record<TaskFilterField, 'status' | 'priority' | 'note' | 'folder'>> = {
  status: 'status',
  priority: 'priority',
  note: 'note',
  folder: 'folder',
}

const dateFields: Partial<Record<TaskFilterField, TaskDateField>> = {
  dueDate: 'dueDate',
  scheduledDate: 'scheduledDate',
  startDate: 'startDate',
  createdDate: 'createdDate',
  doneDate: 'doneDate',
}

const getStringValues = (filter: TaskFilter): string[] =>
  filter.values.filter(
    (value): value is string => typeof value === 'string' && value.trim() !== '',
  )

const getTextPredicate = (
  field: 'description' | 'note' | 'folder',
  filter: TaskFilter,
): TaskPredicate | null => {
  if (filter.operator === 'empty') {
    return (task) => task[field] === ''
  }

  if (filter.operator === 'not_empty') {
    return (task) => task[field] !== ''
  }

  const values = getStringValues(filter).map((value) => fold(value.trim()))

  if (values.length === 0) {
    return null
  }

  const matches = (test: (text: string, value: string) => boolean): TaskPredicate =>
    (task) => {
      const text = fold(task[field])
      return values.some((value) => test(text, value))
    }

  switch (filter.operator) {
    case 'contains':
      return matches((text, value) => text.includes(value))
    case 'not_contains': {
      const contains = matches((text, value) => text.includes(value))
      return (task) => !contains(task)
    }
    case 'starts_with':
      return matches((text, value) => text.startsWith(value))
    case 'ends_with':
      return matches((text, value) => text.endsWith(value))
    case 'is':
      return matches((text, value) => text === value)
    default:
      return null
  }
}

const getChoicePredicate = (valueOf: (task: IndexedTask) => string, filter: TaskFilter): TaskPredicate | null => {
  if (filter.operator === 'empty') {
    return (task) => valueOf(task) === ''
  }

  if (filter.operator === 'not_empty') {
    return (task) => valueOf(task) !== ''
  }

  const values = new Set(getStringValues(filter))

  if (values.size === 0) {
    return null
  }

  switch (filter.operator) {
    case 'is':
    case 'is_any_of':
      return (task) => values.has(valueOf(task))
    case 'is_not':
    case 'is_not_any_of':
      return (task) => !values.has(valueOf(task))
    default:
      return null
  }
}

type DateRange = { from: string | null; to: string | null }

const getDateRange = (bucket: DateBucket, today: string): DateRange => {
  switch (bucket) {
    case 'past':
      return { from: null, to: addDays(today, -1) }
    case 'yesterday':
      return { from: addDays(today, -1), to: addDays(today, -1) }
    case 'today':
      return { from: today, to: today }
    case 'tomorrow':
      return { from: addDays(today, 1), to: addDays(today, 1) }
    case 'last_7_days':
      return { from: addDays(today, -6), to: today }
    case 'next_7_days':
      return { from: today, to: addDays(today, 6) }
    case 'last_30_days':
      return { from: addDays(today, -29), to: today }
    case 'future':
      return { from: addDays(today, 1), to: null }
    case 'any':
      return { from: null, to: null }
  }
}

// A value is a relative bucket such as "next_7_days" or one exact ISO date.
const toDateRange = (value: string, today: string): DateRange | null => {
  const bucket = dateBucketSchema.safeParse(value)
  if (bucket.success) {
    return getDateRange(bucket.data, today)
  }
  return isoDateSchema.safeParse(value).success ? { from: value, to: value } : null
}

const isInRange = (date: string | null, range: DateRange): boolean =>
  date !== null &&
  (range.from === null || date >= range.from) &&
  (range.to === null || date <= range.to)

const getDatePredicate = (
  getDate: (task: IndexedTask) => string | null,
  filter: TaskFilter,
  today: string,
): TaskPredicate | null => {
  if (filter.operator === 'empty') {
    return (task) => getDate(task) === null
  }

  if (filter.operator === 'not_empty') {
    return (task) => getDate(task) !== null
  }

  const ranges = getStringValues(filter)
    .map((value) => toDateRange(value, today))
    .filter((range): range is DateRange => range !== null)

  if (ranges.length === 0) {
    return null
  }

  const matches: TaskPredicate = (task) => {
    const date = getDate(task)
    return ranges.some((range) => isInRange(date, range))
  }

  switch (filter.operator) {
    case 'is':
    case 'is_any_of':
      return matches
    case 'is_not':
    case 'is_not_any_of':
      return (task) => !matches(task)
    default:
      return null
  }
}

// `#type` also matches nested tags such as `#type/task`, as in Obsidian search.
const hasTag = (task: IndexedTask, tag: string): boolean => {
  const wanted = fold(tag.replace(/^#/u, ''))
  return task.tags.some((taskTag) => {
    const folded = fold(taskTag)
    return folded === wanted || folded.startsWith(`${wanted}/`)
  })
}

const getTagsPredicate = (filter: TaskFilter): TaskPredicate | null => {
  if (filter.operator === 'empty') {
    return (task) => task.tags.length === 0
  }

  if (filter.operator === 'not_empty') {
    return (task) => task.tags.length > 0
  }

  const values = getStringValues(filter)

  if (values.length === 0) {
    return null
  }

  switch (filter.operator) {
    case 'is':
    case 'is_any_of':
      return (task) => values.some((tag) => hasTag(task, tag))
    case 'is_not':
    case 'is_not_any_of':
    case 'excludes_all':
      return (task) => !values.some((tag) => hasTag(task, tag))
    case 'includes_all':
      return (task) => values.every((tag) => hasTag(task, tag))
    default:
      return null
  }
}

// Inline field values compare without case; a field without a value counts as empty.
const getInlineFieldPredicate = (key: string, filter: TaskFilter): TaskPredicate | null => {
  const valueOf = (task: IndexedTask): string => fold(task.fields[key] ?? '')

  if (filter.operator === 'empty') {
    return (task) => valueOf(task) === ''
  }

  if (filter.operator === 'not_empty') {
    return (task) => valueOf(task) !== ''
  }

  const values = getStringValues(filter).map((value) => fold(value.trim()))

  if (values.length === 0) {
    return null
  }

  const equals: TaskPredicate = (task) => values.includes(valueOf(task))
  const contains: TaskPredicate = (task) => values.some((value) => valueOf(task).includes(value))

  switch (filter.operator) {
    case 'is':
    case 'is_any_of':
      return equals
    case 'is_not':
    case 'is_not_any_of':
      return (task) => !equals(task)
    case 'contains':
      return contains
    case 'not_contains':
      return (task) => !contains(task)
    default:
      return null
  }
}

const textOperators = new Set(['contains', 'not_contains', 'starts_with', 'ends_with'])

const isTextOperator = (filter: TaskFilter): boolean =>
  textOperators.has(filter.operator) || (filter.field === 'description' && filter.operator === 'is')

// What a query needs from outside the task index.
export type TaskQueryContext = {
  // The date of the daily note at this path, or null when it is not a daily note.
  getDailyNoteDate: (filePath: string) => string | null
}

// Returns null for a filter that does not narrow anything yet, such as a chip without values.
export const getFilterPredicate = (
  filter: TaskFilter,
  today: string,
  context: TaskQueryContext,
): TaskPredicate | null => {
  const dateField = dateFields[filter.field]
  if (dateField) {
    return getDatePredicate((task) => task[dateField], filter, today)
  }

  if (filter.field === 'dailyNote') {
    return getDatePredicate((task) => context.getDailyNoteDate(task.filePath), filter, today)
  }

  const fieldKey = getInlineFieldKey(filter.field)
  if (fieldKey !== null) {
    return getInlineFieldPredicate(fieldKey, filter)
  }

  if (filter.field === 'tags') {
    return getTagsPredicate(filter)
  }

  const textField = textFields[filter.field]
  if (textField && isTextOperator(filter)) {
    return getTextPredicate(textField, filter)
  }

  const choiceField = choiceFields[filter.field]
  if (choiceField) {
    return getChoicePredicate((task) => task[choiceField], filter)
  }

  if (filter.field === 'level') {
    return getChoicePredicate(getTaskLevel, filter)
  }

  return textField ? getTextPredicate(textField, filter) : null
}

export const createTaskPredicate = (
  query: TaskListQuery,
  today: string,
  context: TaskQueryContext,
): TaskPredicate => {
  const predicates = query.filters
    .map((filter) => getFilterPredicate(filter, today, context))
    .filter((predicate): predicate is TaskPredicate => predicate !== null)
  const search = fold(query.search.trim())

  if (search !== '') {
    predicates.push(
      (task) => fold(task.description).includes(search) || fold(task.note).includes(search),
    )
  }

  return (task) => predicates.every((predicate) => predicate(task))
}

const statusRanks: Record<TaskStatus, number> = {
  in_progress: 0,
  todo: 1,
  done: 2,
  cancelled: 3,
}

// Higher is more urgent, so sorting by priority descending lists urgent tasks first.
const priorityRanks: Record<TaskPriority, number> = {
  lowest: 0,
  low: 1,
  normal: 2,
  medium: 3,
  high: 4,
  highest: 5,
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

const compareValues = (first: string | number, second: string | number): number =>
  typeof first === 'string' && typeof second === 'string'
    ? collator.compare(first, second)
    : first < second
      ? -1
      : first > second
        ? 1
        : 0

const sortValues: Record<BuiltInSortField, (task: IndexedTask) => string | number | null> = {
  description: (task) => task.description,
  status: (task) => statusRanks[task.status],
  priority: (task) => priorityRanks[task.priority],
  dueDate: (task) => task.dueDate,
  scheduledDate: (task) => task.scheduledDate,
  startDate: (task) => task.startDate,
  createdDate: (task) => task.createdDate,
  doneDate: (task) => task.doneDate,
  // The first tag decides, then the next ones, as written in the task.
  tags: (task) => (task.tags.length > 0 ? task.tags.join(' ') : null),
  note: (task) => task.note,
  folder: (task) => task.folder,
}

// Inline fields sort by their text; numbers in them sort as numbers.
const getSortValue = (id: TaskSortField): ((task: IndexedTask) => string | number | null) => {
  const fieldKey = getInlineFieldKey(id)
  if (fieldKey === null) {
    return sortValues[id as BuiltInSortField]
  }
  return (task) => {
    const value = task.fields[fieldKey]
    return value === undefined || value === '' ? null : value
  }
}

// Tasks without a value go last in both directions; ties keep the notes' order.
export const createTaskComparator = (sorting: TaskListQuery['sorting']): TaskComparator => {
  const rules = sorting.map(({ id, desc }) => ({ getValue: getSortValue(id), desc }))

  return (first, second) => {
    for (const { getValue, desc } of rules) {
      const firstValue = getValue(first)
      const secondValue = getValue(second)

      if (firstValue === secondValue) {
        continue
      }
      if (firstValue === null) {
        return 1
      }
      if (secondValue === null) {
        return -1
      }

      const result = compareValues(firstValue, secondValue)
      if (result !== 0) {
        return desc ? -result : result
      }
    }

    return compareValues(first.filePath, second.filePath) || first.line - second.line
  }
}
