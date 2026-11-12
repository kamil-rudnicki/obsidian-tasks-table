import { LayersIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { taskGroupFields, toInlineFieldId, type TaskGroupField, type TaskGrouping } from '@shared/taskTypes'
import { maxGroupingLevels, type View } from '@shared/viewTypes'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getGroupDirectionLabels, getGroupFieldLabel, keepCollapsedGroups } from '@/logic/groupingLogic'
import { updateViewConfig } from '@/logic/viewActions'
import { ToolbarLabel } from './ToolbarLabel'
import { toolbarButtonClassName } from './toolbarButtonClassName'

// After Normal, priority groups go from most to least urgent by default.
const createGrouping = (field: TaskGroupField): TaskGrouping => ({ field, desc: field === 'priority' })

type GroupLevelProps = {
  // The level's property, or null before one is chosen.
  grouping: TaskGrouping | null
  fields: TaskGroupField[]
  onChange: (grouping: TaskGrouping) => void
  onRemove: () => void
}

const GroupLevel = ({ grouping, fields, onChange, onRemove }: GroupLevelProps) => {
  const fieldItems = fields.map((field) => ({ value: field, label: getGroupFieldLabel(field) }))
  const directions = grouping ? getGroupDirectionLabels(grouping.field) : null
  const directionItems = directions
    ? [
        { value: 'asc', label: directions.asc },
        { value: 'desc', label: directions.desc },
      ]
    : []

  return (
    <div className='flex items-center gap-1'>
      <Select
        items={fieldItems}
        value={grouping?.field ?? null}
        onValueChange={(field: TaskGroupField | null) => field && onChange(createGrouping(field))}
      >
        <SelectTrigger size='sm' className='w-44' aria-label='Group property'>
          <SelectValue placeholder='Choose a property' />
        </SelectTrigger>
        <SelectContent>
          {fieldItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {grouping ? (
        <>
          <Select
            items={directionItems}
            value={grouping.desc ? 'desc' : 'asc'}
            onValueChange={(direction) => onChange({ ...grouping, desc: direction === 'desc' })}
          >
            <SelectTrigger size='sm' className='w-44' aria-label='Group order'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {directionItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant='ghost'
            size='icon-sm'
            aria-label={`Remove group by ${getGroupFieldLabel(grouping.field)}`}
            className='text-muted-foreground'
            onClick={onRemove}
          >
            <Trash2Icon />
          </Button>
        </>
      ) : null}
    </div>
  )
}

// "Group by" a property, then by a second one inside each group. Each group
// gets a header that opens and closes.
export const GroupMenu = ({ view, fieldKeys }: { view: View; fieldKeys: string[] }) => {
  const { grouping, collapsedGroups } = view.config
  const allFields = [...taskGroupFields, ...fieldKeys.map(toInlineFieldId)]
  // A level offers every property the other level does not use.
  const fieldsFor = (level: number) =>
    allFields.filter((field) => !grouping.some((other, at) => at !== level && other.field === field))
  const unused = fieldsFor(-1)
  const setGrouping = (next: TaskGrouping[]) =>
    updateViewConfig(view.id, {
      grouping: next,
      collapsedGroups: keepCollapsedGroups(collapsedGroups, grouping, next),
    })

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant='ghost' size='sm' data-active={grouping.length > 0} className={toolbarButtonClassName} />
        }
      >
        <LayersIcon data-icon='inline-start' />
        <ToolbarLabel>Group</ToolbarLabel>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-auto min-w-72 gap-2 p-2'>
        {(grouping.length > 0 ? grouping : [null]).map((level, index) => (
          <div key={index} className='flex flex-col gap-1'>
            <div className='px-1 pt-1 text-sm font-medium'>{index === 0 ? 'Group by' : 'Then by'}</div>
            <GroupLevel
              grouping={level}
              fields={fieldsFor(index)}
              onChange={(next) => setGrouping(grouping.length === 0 ? [next] : grouping.map((item, at) => (at === index ? next : item)))}
              onRemove={() => setGrouping(grouping.filter((_, at) => at !== index))}
            />
          </div>
        ))}
        {grouping.length > 0 && grouping.length < maxGroupingLevels && unused.length > 0 ? (
          <Button
            variant='ghost'
            size='sm'
            className='justify-start text-muted-foreground'
            onClick={() => setGrouping([...grouping, createGrouping(unused[0])])}
          >
            <PlusIcon data-icon='inline-start' />
            Add subgroup
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
