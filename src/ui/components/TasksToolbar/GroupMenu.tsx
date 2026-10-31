import { LayersIcon, Trash2Icon } from 'lucide-react'
import { taskGroupFields, toInlineFieldId, type TaskGroupField, type TaskGrouping } from '@shared/taskTypes'
import type { View } from '@shared/viewTypes'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getGroupDirectionLabels, getGroupFieldLabel } from '@/logic/groupingLogic'
import { updateViewConfig } from '@/logic/viewActions'
import { ToolbarLabel } from './ToolbarLabel'
import { toolbarButtonClassName } from './toolbarButtonClassName'

// "Group by" one property, like Bases: each value gets a header that opens and closes.
export const GroupMenu = ({ view, fieldKeys }: { view: View; fieldKeys: string[] }) => {
  const { grouping, collapsedGroups } = view.config
  const fieldItems = [...taskGroupFields, ...fieldKeys.map(toInlineFieldId)].map((field) => ({
    value: field,
    label: getGroupFieldLabel(field),
  }))
  // Collapsed groups belong to the property; another property starts with every group open.
  const setGrouping = (next: TaskGrouping | null) =>
    updateViewConfig(view.id, {
      grouping: next,
      collapsedGroups: next !== null && next.field === grouping?.field ? collapsedGroups : [],
    })
  const directions = grouping ? getGroupDirectionLabels(grouping.field) : null
  const directionItems = directions
    ? [
        { value: 'asc', label: directions.asc },
        { value: 'desc', label: directions.desc },
      ]
    : []

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant='ghost' size='sm' data-active={grouping !== null} className={toolbarButtonClassName} />
        }
      >
        <LayersIcon data-icon='inline-start' />
        <ToolbarLabel>Group</ToolbarLabel>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-auto min-w-72 gap-2 p-2'>
        <div className='px-1 pt-1 text-sm font-medium'>Group by</div>
        <div className='flex items-center gap-1'>
          <Select
            items={fieldItems}
            value={grouping?.field ?? null}
            // Urgent tasks come first when grouping by priority.
            onValueChange={(field: TaskGroupField | null) => field && setGrouping({ field, desc: field === 'priority' })}
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
                onValueChange={(direction) => setGrouping({ ...grouping, desc: direction === 'desc' })}
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
                aria-label='Remove group'
                className='text-muted-foreground'
                onClick={() => setGrouping(null)}
              >
                <Trash2Icon />
              </Button>
            </>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
