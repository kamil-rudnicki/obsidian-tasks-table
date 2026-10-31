import { z } from 'zod'

export const taskStatuses = ['todo', 'in_progress', 'done', 'cancelled'] as const
export const taskStatusSchema = z.enum(taskStatuses)
export type TaskStatus = z.infer<typeof taskStatusSchema>

// Ordered from the most to the least urgent, as the Obsidian Tasks plugin ranks them.
export const taskPriorities = [
  'highest',
  'high',
  'medium',
  'normal',
  'low',
  'lowest',
] as const
export const taskPrioritySchema = z.enum(taskPriorities)
export type TaskPriority = z.infer<typeof taskPrioritySchema>

export const isoDateSchema = z.iso.date()

export const taskDateFields = [
  'dueDate',
  'scheduledDate',
  'startDate',
  'createdDate',
  'doneDate',
  'cancelledDate',
] as const
export type TaskDateField = (typeof taskDateFields)[number]

export type Task = {
  id: string
  // Path relative to the vault root, always with `/` separators.
  filePath: string
  note: string
  folder: string
  // Zero-based line number inside the note.
  line: number
  // 1 for a task that is not inside another list item, 2 for one inside it, and so on.
  level: number
  // Task text without the checkbox and the structured metadata. Keeps tags and links.
  description: string
  status: TaskStatus
  statusSymbol: string
  priority: TaskPriority
  dueDate: string | null
  scheduledDate: string | null
  startDate: string | null
  createdDate: string | null
  doneDate: string | null
  cancelledDate: string | null
  tags: string[]
  // Dataview inline fields such as `[type:: work]`, by lowercase name. Fields
  // that have columns of their own, such as `due`, are not repeated here.
  fields: Record<string, string>
  // Every link in the task, in the order it appears.
  links: TaskLink[]
}

// A wiki link or Markdown link to a note, or a web address.
export type TaskLink = {
  // A note path or link text for notes, a full address for web links.
  target: string
  text: string
  external: boolean
}

// A Dataview inline field as a filter, sort or column: `field:type` for `[type:: work]`.
export type InlineFieldId = `field:${string}`
export const inlineFieldIdSchema = z.templateLiteral([z.literal('field:'), z.string().min(1).max(100)])

export const toInlineFieldId = (key: string): InlineFieldId => `field:${key}`

export const getInlineFieldKey = (id: string): string | null =>
  id.startsWith('field:') ? id.slice('field:'.length) : null

export const taskFilterFields = [
  'description',
  'status',
  'priority',
  'dueDate',
  'scheduledDate',
  'startDate',
  'createdDate',
  'doneDate',
  'tags',
  'note',
  'folder',
  // The date of the daily note that holds the task. Notes that are not daily notes have none.
  'dailyNote',
  // Whether the task is a subtask: inside another list item, a task or a bullet.
  'level',
] as const
export type BuiltInFilterField = (typeof taskFilterFields)[number]
export const taskFilterFieldSchema = z.union([z.enum(taskFilterFields), inlineFieldIdSchema])
export type TaskFilterField = z.infer<typeof taskFilterFieldSchema>

export const taskFilterOperators = [
  'is',
  'is_not',
  'is_any_of',
  'is_not_any_of',
  'includes_all',
  'excludes_all',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'empty',
  'not_empty',
] as const
export const taskFilterOperatorSchema = z.enum(taskFilterOperators)
export type TaskFilterOperator = z.infer<typeof taskFilterOperatorSchema>

// The values of the level filter.
export const taskLevels = ['first', 'subtask'] as const
export type TaskLevel = (typeof taskLevels)[number]

export const getTaskLevel = (task: Pick<Task, 'level'>): TaskLevel => (task.level === 1 ? 'first' : 'subtask')

// Relative buckets keep saved date filters meaningful on every day.
export const dateBuckets = [
  'past',
  'yesterday',
  'today',
  'tomorrow',
  'last_7_days',
  'next_7_days',
  'last_30_days',
  'future',
  // Any date at all, for example "in any daily note".
  'any',
] as const
export const dateBucketSchema = z.enum(dateBuckets)
export type DateBucket = z.infer<typeof dateBucketSchema>

export const taskFilterSchema = z.object({
  id: z.string().min(1).max(200),
  field: taskFilterFieldSchema,
  operator: taskFilterOperatorSchema,
  values: z
    .array(z.union([z.string().max(1000), z.number(), z.boolean(), z.null()]))
    .max(200),
})
export type TaskFilter = z.infer<typeof taskFilterSchema>

export const taskSortFields = [
  'description',
  'status',
  'priority',
  'dueDate',
  'scheduledDate',
  'startDate',
  'createdDate',
  'doneDate',
  'tags',
  'note',
  'folder',
] as const
export type BuiltInSortField = (typeof taskSortFields)[number]
export const taskSortFieldSchema = z.union([z.enum(taskSortFields), inlineFieldIdSchema])
export type TaskSortField = z.infer<typeof taskSortFieldSchema>

export const taskSortSchema = z.object({
  id: taskSortFieldSchema,
  desc: z.boolean(),
})
export type TaskSort = z.infer<typeof taskSortSchema>

// The properties a view can group its tasks by.
export const taskGroupFields = [
  'status',
  'priority',
  'dueDate',
  'scheduledDate',
  'startDate',
  'createdDate',
  'doneDate',
  'tags',
  'note',
  'folder',
  'level',
] as const
export type BuiltInGroupField = (typeof taskGroupFields)[number]
export const taskGroupFieldSchema = z.union([z.enum(taskGroupFields), inlineFieldIdSchema])
export type TaskGroupField = z.infer<typeof taskGroupFieldSchema>

export const taskGroupingSchema = z.object({
  field: taskGroupFieldSchema,
  desc: z.boolean(),
})
export type TaskGrouping = z.infer<typeof taskGroupingSchema>

export const taskListQuerySchema = z.object({
  filters: z.array(taskFilterSchema).max(30),
  sorting: z.array(taskSortSchema).max(taskSortFields.length),
  search: z.string().max(500),
})
export type TaskListQuery = z.infer<typeof taskListQuerySchema>

export const taskDescriptionSchema = z.string().trim().min(1).max(5000)

// An Obsidian tag without its `#`: letters, digits, `_`, `-` and `/` for nested
// tags, and at least one character that is not a digit.
export const tagSchema = z
  .string()
  .max(200)
  .regex(/^[\p{L}\p{N}_/-]+$/u)
  .regex(/[^\p{N}]/u)

// Tags in name order without case. Numbers compare by value: `2m` before `15m`.
export const compareTags = (first: string, second: string): number =>
  first.localeCompare(second, undefined, { numeric: true, sensitivity: 'base' })

export const taskChangesSchema = z
  .object({
    description: taskDescriptionSchema,
    // Every tag the task should have. Tags that are not listed are removed.
    tags: z.array(tagSchema).max(100),
    status: taskStatusSchema,
    priority: taskPrioritySchema,
    dueDate: isoDateSchema.nullable(),
    scheduledDate: isoDateSchema.nullable(),
    startDate: isoDateSchema.nullable(),
  })
  .partial()
export type TaskChanges = z.infer<typeof taskChangesSchema>

export const updateTaskInputSchema = z.object({
  id: z.string().min(1).max(200),
  changes: taskChangesSchema,
})
export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>

export const createTaskInputSchema = z.object({
  description: taskDescriptionSchema,
  priority: taskPrioritySchema.optional(),
  dueDate: isoDateSchema.nullable().optional(),
})
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>

export const taskOptionFields = ['tags', 'note', 'folder'] as const
export const taskOptionsInputSchema = z.object({
  field: z.union([z.enum(taskOptionFields), inlineFieldIdSchema]),
  search: z.string().max(200),
})
export type TaskOptionsInput = z.infer<typeof taskOptionsInputSchema>
