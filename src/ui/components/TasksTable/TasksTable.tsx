'use no memo'

import { useMemo, type ReactNode } from 'react'
import {
  BracketsIcon,
  CalendarIcon,
  CircleDashedIcon,
  FileTextIcon,
  FlagIcon,
  FolderIcon,
  HashIcon,
  LinkIcon,
  TextIcon,
  type LucideIcon,
} from 'lucide-react'
import {
  useTable,
  type ColumnDef,
  type ColumnOrderState,
  type ColumnSizingState,
  type ColumnVisibilityState,
  type ExpandedState,
  type SortingState,
  type Updater,
} from '@tanstack/react-table'
import {
  taskSortFieldSchema,
  toInlineFieldId,
  type Task,
  type TaskGroupField,
  type TaskSort,
} from '@shared/taskTypes'
import type { View } from '@shared/viewTypes'
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridCellsChangeDetails,
  type DataGridFeatures,
} from '@/components/reui/data-grid/data-grid'
import { DataGridCellSelection } from '@/components/reui/data-grid/data-grid-cell-selection'
import type { DataGridI18nOverrides } from '@/components/reui/data-grid/data-grid-i18n'
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header'
import { DataGridScrollArea } from '@/components/reui/data-grid/data-grid-scroll-area'
import { DataGridTableVirtual } from '@/components/reui/data-grid/data-grid-table-virtual'
import { TaskActionsCell } from '@/components/TaskCells/TaskActionsCell'
import { TaskCompleteCell } from '@/components/TaskCells/TaskCompleteCell'
import { TaskDateCell } from '@/components/TaskCells/TaskDateCell'
import { TaskFieldCell } from '@/components/TaskCells/TaskFieldCell'
import { TaskLinksCell } from '@/components/TaskCells/TaskLinksCell'
import { TaskNoteCell } from '@/components/TaskCells/TaskNoteCell'
import { TaskPriorityCell } from '@/components/TaskCells/TaskPriorityCell'
import { TaskReadOnlyDateCell } from '@/components/TaskCells/TaskReadOnlyDateCell'
import { TaskStatusCell } from '@/components/TaskCells/TaskStatusCell'
import { TaskTagsCell } from '@/components/TaskCells/TaskTagsCell'
import { TaskTitleCell } from '@/components/TaskCells/TaskTitleCell'
import { TaskGroupRow } from './TaskGroupRow'
import { getColumnOrder, getColumnVisibility } from '@/logic/fieldColumnsLogic'
import {
  getCollapsedGroups,
  getExpandedGroups,
  getGroupKey,
  groupColumnId,
  groupTasks,
} from '@/logic/groupingLogic'
import { updateTask } from '@/logic/taskActions'
import { columnLabels } from '@/logic/taskLabels'
import { updateViewConfig } from '@/logic/viewActions'

type TasksTableProps = {
  view: View
  tasks: Task[]
  // Inline field names the vault uses; each can be shown as a column.
  fieldKeys: string[]
  isLoading: boolean
  emptyMessage: ReactNode
  // Rendered inside the grid so the toolbar can reach the table, for example for properties.
  toolbar: ReactNode
}

const headerIcon = (Icon: LucideIcon) => <Icon className='size-3.5 text-muted-foreground' />

// Every header shows the property's icon, as in Bases.
const header =
  (title: string, Icon: LucideIcon): ColumnDef<DataGridFeatures, Task>['header'] =>
  ({ column }) => <DataGridColumnHeader title={title} icon={headerIcon(Icon)} column={column} />

const fixedColumn = {
  enableSorting: false,
  enableHiding: false,
  enableResizing: false,
} as const

const builtInColumns: ColumnDef<DataGridFeatures, Task>[] = [
  {
    id: 'complete',
    header: () => <span className='sr-only'>{columnLabels.complete}</span>,
    cell: ({ row }) => <TaskCompleteCell task={row.original} />,
    size: 40,
    ...fixedColumn,
    meta: { headerTitle: columnLabels.complete, cellClassName: 'px-0', headerClassName: 'px-0' },
  },
  {
    id: 'description',
    accessorKey: 'description',
    header: header(columnLabels.description, TextIcon),
    cell: ({ row }) => <TaskTitleCell task={row.original} />,
    size: 420,
    minSize: 200,
    enableHiding: false,
    meta: {
      headerTitle: columnLabels.description,
      fillWidth: true,
      cellEdit: {
        control: 'text',
        // An empty title would remove the task text from the note.
        parse: (raw) => (raw.trim() === '' ? undefined : raw.trim()),
        format: (value) => (typeof value === 'string' ? value : ''),
      },
    },
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: header(columnLabels.status, CircleDashedIcon),
    cell: ({ row }) => <TaskStatusCell task={row.original} />,
    size: 132,
    meta: { headerTitle: columnLabels.status },
  },
  {
    id: 'priority',
    accessorKey: 'priority',
    header: header(columnLabels.priority, FlagIcon),
    cell: ({ row }) => <TaskPriorityCell task={row.original} />,
    size: 112,
    meta: { headerTitle: columnLabels.priority },
  },
  ...(['dueDate', 'scheduledDate', 'startDate'] as const).map(
    (field): ColumnDef<DataGridFeatures, Task> => ({
      id: field,
      accessorKey: field,
      header: header(columnLabels[field], CalendarIcon),
      cell: ({ row }) => <TaskDateCell task={row.original} field={field} />,
      size: 120,
      meta: { headerTitle: columnLabels[field] },
    }),
  ),
  {
    id: 'tags',
    accessorKey: 'tags',
    header: header(columnLabels.tags, HashIcon),
    cell: ({ row }) => <TaskTagsCell task={row.original} />,
    size: 180,
    meta: { headerTitle: columnLabels.tags },
  },
  {
    id: 'links',
    accessorFn: (task) => task.links.map((link) => link.text).join(' '),
    header: header(columnLabels.links, LinkIcon),
    cell: ({ row }) => <TaskLinksCell task={row.original} />,
    size: 220,
    enableSorting: false,
    meta: { headerTitle: columnLabels.links },
  },
  {
    id: 'note',
    accessorKey: 'note',
    header: header(columnLabels.note, FileTextIcon),
    cell: ({ row }) => <TaskNoteCell task={row.original} />,
    size: 200,
    meta: { headerTitle: columnLabels.note },
  },
  {
    id: 'folder',
    accessorKey: 'folder',
    header: header(columnLabels.folder, FolderIcon),
    cell: ({ row }) => (
      <span className='block truncate text-muted-foreground'>{row.original.folder}</span>
    ),
    size: 180,
    meta: { headerTitle: columnLabels.folder },
  },
  ...(['createdDate', 'doneDate'] as const).map(
    (field): ColumnDef<DataGridFeatures, Task> => ({
      id: field,
      accessorKey: field,
      header: header(columnLabels[field], CalendarIcon),
      cell: ({ row }) => <TaskReadOnlyDateCell value={row.original[field]} />,
      size: 120,
      meta: { headerTitle: columnLabels[field] },
    }),
  ),
  {
    id: 'actions',
    header: () => <span className='sr-only'>{columnLabels.actions}</span>,
    cell: ({ row }) => <TaskActionsCell task={row.original} />,
    size: 44,
    ...fixedColumn,
    meta: { headerTitle: columnLabels.actions, cellClassName: 'px-0', headerClassName: 'px-0' },
  },
]

const createFieldColumn = (key: string): ColumnDef<DataGridFeatures, Task> => ({
  id: toInlineFieldId(key),
  accessorFn: (task) => task.fields[key] ?? '',
  header: header(key, BracketsIcon),
  cell: ({ row }) => <TaskFieldCell value={row.original.fields[key]} />,
  size: 140,
  meta: { headerTitle: key },
})

// The hidden column the rows are grouped by; each group's header renders in its place.
const createGroupColumn = (field: TaskGroupField): ColumnDef<DataGridFeatures, Task> => ({
  id: groupColumnId,
  accessorFn: (task) => getGroupKey(task, field),
  header: () => null,
  cell: () => null,
  enableHiding: false,
  enableSorting: false,
  enableResizing: false,
  meta: { headerTitle: 'Group' },
})

// The group column is never shown, so the view does not save it.
const withoutGroupColumn = <Value,>(state: Record<string, Value>): Record<string, Value> =>
  Object.fromEntries(Object.entries(state).filter(([columnId]) => columnId !== groupColumnId))

// Sentence case and the words this table uses, like "properties" for columns.
const dataGridI18n: DataGridI18nOverrides = {
  labels: {
    sortAscending: 'Sort ascending',
    sortDescending: 'Sort descending',
    columnsMenu: 'Properties',
    toggleColumns: 'Properties',
    unpinColumn: (title) => `Unpin ${title}`,
    loading: 'Loading tasks…',
    empty: 'No tasks',
  },
}

const resolve = <Value,>(updater: Updater<Value>, previous: Value): Value =>
  typeof updater === 'function' ? (updater as (value: Value) => Value)(previous) : updater

const toTaskSorting = (sorting: SortingState): TaskSort[] =>
  sorting.flatMap(({ id, desc }) => {
    const field = taskSortFieldSchema.safeParse(id)
    return field.success ? [{ id: field.data, desc }] : []
  })

const handleCellsChange = ({ changes }: DataGridCellsChangeDetails<Task>): void => {
  for (const change of changes) {
    if (
      change.columnId === 'description' &&
      typeof change.value === 'string' &&
      change.value !== change.row.description
    ) {
      void updateTask(change.row, { description: change.value })
    }
  }
}

export const TasksTable = ({ view, tasks, fieldKeys, isLoading, emptyMessage, toolbar }: TasksTableProps) => {
  const { config } = view
  const { grouping, collapsedGroups } = config
  const groupField = grouping?.field ?? null
  // TanStack Table rebuilds its models when `columns` changes identity; `fieldKeys`
  // keeps its identity until the vault's field names change.
  const columns = useMemo(
    () => [
      ...builtInColumns.slice(0, -1),
      ...fieldKeys.map(createFieldColumn),
      ...builtInColumns.slice(-1),
      ...(groupField === null ? [] : [createGroupColumn(groupField)]),
    ],
    [fieldKeys, groupField],
  )
  // TanStack lists groups in the order their first rows come, so the rows
  // arrive in group order, each group keeping the view's sort.
  const groups = useMemo(() => (grouping ? groupTasks(tasks, grouping) : null), [tasks, grouping])
  const data = useMemo(() => (groups ? groups.flatMap((group) => group.tasks) : tasks), [groups, tasks])
  const groupKeys = groups?.map((group) => group.key) ?? []
  const expanded = getExpandedGroups(groupKeys, collapsedGroups)
  const columnVisibility = {
    ...getColumnVisibility(config.columnVisibility, fieldKeys),
    [groupColumnId]: false,
  }
  const columnOrder = getColumnOrder(
    config.columnOrder,
    columns.map((column) => column.id ?? '').filter((columnId) => columnId !== groupColumnId),
  )
  const table = useTable({
    features: dataGridFeatures,
    columns,
    data,
    getRowId: (task) => task.id,
    state: {
      sorting: config.sorting,
      columnVisibility,
      columnOrder,
      columnSizing: config.columnSizing,
      grouping: groupField === null ? [] : [groupColumnId],
      expanded,
    },
    // Grouped rows keep the columns in place, and a change of tasks keeps the collapsed groups.
    groupedColumnMode: false,
    autoResetExpanded: false,
    // A group's header has no cells to select or edit.
    enableCellSelection: (cell) => !cell.row.getIsGrouped(),
    onExpandedChange: (updater) =>
      updateViewConfig(view.id, {
        collapsedGroups: getCollapsedGroups(resolve<ExpandedState>(updater, expanded), groupKeys, collapsedGroups),
      }),
    // The task index sorts and filters; the table shows every row it returns, virtualized.
    manualSorting: true,
    manualFiltering: true,
    manualPagination: true,
    enableMultiSort: true,
    columnResizeMode: 'onChange',
    onSortingChange: (updater) =>
      updateViewConfig(view.id, { sorting: toTaskSorting(resolve(updater, config.sorting)) }),
    onColumnVisibilityChange: (updater) =>
      updateViewConfig(view.id, {
        columnVisibility: withoutGroupColumn(resolve<ColumnVisibilityState>(updater, columnVisibility)),
      }),
    onColumnOrderChange: (updater) =>
      updateViewConfig(view.id, {
        columnOrder: resolve<ColumnOrderState>(updater, columnOrder).filter((columnId) => columnId !== groupColumnId),
      }),
    onColumnSizingChange: (updater) =>
      updateViewConfig(view.id, {
        columnSizing: resolve<ColumnSizingState>(updater, config.columnSizing),
      }),
  })

  return (
    <DataGrid
      table={table}
      recordCount={tasks.length}
      isLoading={isLoading}
      loadingMode='skeleton'
      emptyMessage={emptyMessage}
      i18n={dataGridI18n}
      onCellsChange={handleCellsChange}
      renderGroupRow={groupField === null ? undefined : (row) => <TaskGroupRow row={row} field={groupField} />}
      tableLayout={{
        dense: true,
        headerSticky: true,
        rowBorder: true,
        cellBorder: true,
        width: 'fixed',
        columnsResizable: true,
        columnsResizeMode: 'onChange',
        columnsMovable: true,
        columnsVisibility: true,
        cellSelection: true,
        cellSelectionMode: 'single',
        cellEditMode: 'click',
      }}
      // The frame is drawn with the cells' own borders, inside their widths: a
      // border on the table would make it 2px wider than the pane and add a
      // horizontal scrollbar.
      tableClassNames={{
        headerRow: '[&>th]:border-t [&>th:first-child]:border-s [&>th:last-child]:border-e',
        headerSticky: 'sticky top-0 z-40 bg-background',
        bodyRow: 'group/row [&>td:first-child]:border-s [&>td:last-child]:border-e',
      }}
    >
      {toolbar}
      <DataGridCellSelection />
      {/* The scroll area fills the pane; the frame is on the table, so a short list ends with its last row. */}
      <DataGridContainer className='min-h-0 flex-1 px-3 pb-3 [&>div]:h-full'>
        <DataGridScrollArea className='h-full'>
          <DataGridTableVirtual estimateSize={36} overscan={12} />
        </DataGridScrollArea>
      </DataGridContainer>
    </DataGrid>
  )
}
