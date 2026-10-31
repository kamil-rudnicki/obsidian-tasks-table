import type { ViewConfig } from '@shared/viewTypes'

export const taskColumnIds = [
  'complete',
  'description',
  'status',
  'priority',
  'dueDate',
  'scheduledDate',
  'startDate',
  'tags',
  'links',
  'note',
  'folder',
  'createdDate',
  'doneDate',
  'actions',
] as const
export type TaskColumnId = (typeof taskColumnIds)[number]

const hiddenByDefault: TaskColumnId[] = [
  'scheduledDate',
  'startDate',
  'links',
  'folder',
  'createdDate',
  'doneDate',
]

// Columns added after views were first saved. They stay hidden in those views
// until turned on in Properties.
export const optionalColumnIds: TaskColumnId[] = ['links']

export const createDefaultViewConfig = (
  overrides: Partial<ViewConfig> = {},
): ViewConfig => ({
  filters: [],
  sorting: [],
  columnVisibility: Object.fromEntries(
    hiddenByDefault.map((columnId) => [columnId, false]),
  ),
  columnOrder: [...taskColumnIds],
  columnSizing: {},
  grouping: [],
  collapsedGroups: [],
  ...overrides,
})

const openStatusFilter = {
  id: 'open-status',
  field: 'status',
  operator: 'is_any_of',
  values: ['todo', 'in_progress'],
} as const

export const defaultViews: Array<{ name: string; config: ViewConfig }> = [
  {
    name: 'Open',
    config: createDefaultViewConfig({
      filters: [{ ...openStatusFilter, values: [...openStatusFilter.values] }],
      sorting: [
        { id: 'status', desc: false },
        { id: 'priority', desc: true },
        { id: 'dueDate', desc: false },
      ],
    }),
  },
  {
    name: 'Upcoming',
    config: createDefaultViewConfig({
      filters: [
        { ...openStatusFilter, values: [...openStatusFilter.values] },
        {
          id: 'upcoming-due',
          field: 'dueDate',
          operator: 'is_any_of',
          values: ['past', 'today', 'next_7_days'],
        },
      ],
      sorting: [{ id: 'dueDate', desc: false }],
    }),
  },
  {
    name: 'Completed',
    config: createDefaultViewConfig({
      filters: [
        { id: 'done-status', field: 'status', operator: 'is_any_of', values: ['done'] },
      ],
      sorting: [{ id: 'doneDate', desc: true }],
      columnVisibility: {
        scheduledDate: false,
        startDate: false,
        folder: false,
        createdDate: false,
        status: false,
      },
    }),
  },
  {
    name: 'All tasks',
    config: createDefaultViewConfig(),
  },
]
