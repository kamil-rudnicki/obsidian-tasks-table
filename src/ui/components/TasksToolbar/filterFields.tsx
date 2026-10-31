import {
  BracketsIcon,
  CalendarDaysIcon,
  CalendarIcon,
  CircleDashedIcon,
  FileTextIcon,
  FlagIcon,
  FolderIcon,
  HashIcon,
  ListTreeIcon,
  TextIcon,
  type LucideIcon,
} from 'lucide-react'
import { taskLevels, taskPriorities, taskStatuses, toInlineFieldId, type TaskOptionsInput } from '@shared/taskTypes'
import type { FilterFieldConfig, FilterI18nConfig, FilterOperator } from '@/components/reui/filters'
import { TagColorDot } from '@/components/TagBadge/TagBadge'
import { TaskPriorityIcon } from '@/components/TaskCells/TaskPriorityIcon'
import { TaskStatusIcon } from '@/components/TaskCells/TaskStatusIcon'
import { invoke } from '@/lib/api'
import {
  dailyNoteBucketLabels,
  filterLabels,
  getDateBucketLabels,
  levelLabels,
  priorityLabels,
  statusLabels,
} from '@/logic/taskLabels'

// "is" and "is not" take one value; "is any of" and "is not any of" take several.
const choiceOperators: FilterOperator[] = [
  { value: 'is', label: 'is', supportsMultiple: false },
  { value: 'is_not', label: 'is not', supportsMultiple: false },
  { value: 'is_any_of', label: 'is any of', supportsMultiple: true },
  { value: 'is_not_any_of', label: 'is not any of', supportsMultiple: true },
]

const dateOperators: FilterOperator[] = [
  ...choiceOperators,
  { value: 'empty', label: 'is empty' },
  { value: 'not_empty', label: 'is not empty' },
]

const fieldIcon = (Icon: LucideIcon) => <Icon className='size-3.5' />

const inlineFieldOperators: FilterOperator[] = [
  ...choiceOperators,
  { value: 'empty', label: 'is empty' },
  { value: 'not_empty', label: 'is not empty' },
]

const loadOptions =
  (field: TaskOptionsInput['field']) =>
  async (search: string) =>
    (await invoke('tasks:options', { field, search })).map((value) =>
      field === 'tags' ? { value, label: `#${value}`, icon: <TagColorDot tag={value} /> } : { value, label: value },
    )

// Tags need no loaded options: the color and the label come from the tag itself.
const TagFilterValue = ({ tags }: { tags: string[] }) => (
  <>
    {tags.length > 0 ? (
      <span className='flex items-center -space-x-0.5'>
        {tags.slice(0, 3).map((tag) => (
          <TagColorDot key={tag} tag={tag} />
        ))}
      </span>
    ) : null}
    {tags.length === 0 ? filterI18n.select : tags.length === 1 ? `#${tags[0]}` : `${tags.length} selected`}
  </>
)

const dateField = (
  key: 'dueDate' | 'scheduledDate' | 'startDate' | 'createdDate' | 'doneDate',
): FilterFieldConfig => ({
  key,
  label: filterLabels[key],
  icon: fieldIcon(CalendarIcon),
  type: 'select',
  searchable: false,
  operators: dateOperators,
  defaultOperator: 'is',
  className: 'w-40',
  options: getDateBucketLabels(key),
})

const builtInFilterFields: FilterFieldConfig[] = [
  {
    key: 'description',
    label: filterLabels.description,
    icon: fieldIcon(TextIcon),
    type: 'text',
    className: 'w-48',
  },
  {
    key: 'status',
    label: filterLabels.status,
    icon: fieldIcon(CircleDashedIcon),
    type: 'select',
    searchable: false,
    operators: choiceOperators,
    defaultOperator: 'is',
    className: 'w-40',
    options: taskStatuses.map((status) => ({
      value: status,
      label: statusLabels[status],
      icon: <TaskStatusIcon status={status} className='size-3.5' />,
    })),
  },
  {
    key: 'priority',
    label: filterLabels.priority,
    icon: fieldIcon(FlagIcon),
    type: 'select',
    searchable: false,
    operators: choiceOperators,
    defaultOperator: 'is',
    className: 'w-36',
    options: taskPriorities.map((priority) => ({
      value: priority,
      label: priorityLabels[priority],
      icon: <TaskPriorityIcon priority={priority} />,
    })),
  },
  dateField('dueDate'),
  dateField('scheduledDate'),
  dateField('startDate'),
  {
    key: 'tags',
    label: filterLabels.tags,
    icon: fieldIcon(HashIcon),
    type: 'multiselect',
    searchable: true,
    className: 'w-44',
    loadOptions: loadOptions('tags'),
    customValueRenderer: (values) => <TagFilterValue tags={values.map(String)} />,
  },
  {
    key: 'note',
    label: filterLabels.note,
    icon: fieldIcon(FileTextIcon),
    type: 'select',
    searchable: true,
    operators: choiceOperators,
    defaultOperator: 'is',
    className: 'w-48',
    loadOptions: loadOptions('note'),
  },
  {
    key: 'dailyNote',
    label: filterLabels.dailyNote,
    icon: fieldIcon(CalendarDaysIcon),
    type: 'select',
    searchable: false,
    operators: choiceOperators,
    defaultOperator: 'is',
    className: 'w-40',
    options: dailyNoteBucketLabels,
  },
  {
    key: 'folder',
    label: filterLabels.folder,
    icon: fieldIcon(FolderIcon),
    type: 'select',
    searchable: true,
    operators: choiceOperators,
    defaultOperator: 'is',
    className: 'w-48',
    loadOptions: loadOptions('folder'),
  },
  {
    key: 'level',
    label: filterLabels.level,
    icon: fieldIcon(ListTreeIcon),
    type: 'select',
    searchable: false,
    // A task is at the first level or a subtask, so one value is enough.
    operators: [{ value: 'is', label: 'is', supportsMultiple: false }],
    defaultOperator: 'is',
    className: 'w-36',
    options: taskLevels.map((level) => ({ value: level, label: levelLabels[level] })),
  },
  dateField('createdDate'),
  dateField('doneDate'),
]

// A Dataview inline field such as `[type:: work]`, with the values tasks use as options.
const inlineField = (key: string): FilterFieldConfig => ({
  key: toInlineFieldId(key),
  label: key,
  icon: fieldIcon(BracketsIcon),
  type: 'select',
  searchable: true,
  operators: inlineFieldOperators,
  defaultOperator: 'is',
  className: 'w-44',
  loadOptions: loadOptions(toInlineFieldId(key)),
})

// The built-in fields first, then the vault's inline fields by how often tasks use them.
export const createFilterFields = (fieldKeys: string[]): FilterFieldConfig[] => [
  ...builtInFilterFields,
  ...fieldKeys.map(inlineField),
]

export const filterI18n: Partial<FilterI18nConfig> = {
  searchFields: 'Filter by…',
  select: 'Select…',
  loadingOptions: 'Loading…',
  errorLoadingOptions: 'The options could not load.',
}
