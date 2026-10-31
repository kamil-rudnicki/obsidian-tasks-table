import { ArrowUpDownIcon, GripVerticalIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { taskSortFields, toInlineFieldId, type TaskSort, type TaskSortField } from '@shared/taskTypes'
import type { View } from '@shared/viewTypes'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getSortDirectionLabels, getSortFieldLabel } from '@/logic/taskLabels'
import { updateViewConfig } from '@/logic/viewActions'
import { ToolbarLabel } from './ToolbarLabel'
import { toolbarButtonClassName } from './toolbarButtonClassName'

type SortRowProps = {
  sort: TaskSort
  available: TaskSortField[]
  onChange: (sort: TaskSort) => void
  onRemove: () => void
}

const SortRow = ({ sort, available, onChange, onRemove }: SortRowProps) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: sort.id })
  const directions = getSortDirectionLabels(sort.id)
  const fieldItems = [sort.id, ...available].map((field) => ({ value: field, label: getSortFieldLabel(field) }))
  const directionItems = [
    { value: 'asc', label: directions.asc },
    { value: 'desc', label: directions.desc },
  ]

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className='flex items-center gap-1 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80'
      data-dragging={isDragging}
    >
      <button
        ref={setActivatorNodeRef}
        type='button'
        aria-label={`Move ${getSortFieldLabel(sort.id)}`}
        className='flex h-7 w-5 shrink-0 cursor-grab items-center justify-center rounded-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing'
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className='size-3.5' />
      </button>
      <Select
        items={fieldItems}
        value={sort.id}
        onValueChange={(field) => field && onChange({ ...sort, id: field })}
      >
        <SelectTrigger size='sm' className='w-36' aria-label='Sort property'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fieldItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        items={directionItems}
        value={sort.desc ? 'desc' : 'asc'}
        onValueChange={(direction) => onChange({ ...sort, desc: direction === 'desc' })}
      >
        <SelectTrigger size='sm' className='w-36' aria-label='Sort direction'>
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
        aria-label={`Remove sort by ${getSortFieldLabel(sort.id)}`}
        className='text-muted-foreground'
        onClick={onRemove}
      >
        <Trash2Icon />
      </Button>
    </li>
  )
}

// "Sort by" rules in order, like Bases: pick a property and a direction, drag to reorder.
export const SortMenu = ({ view, fieldKeys }: { view: View; fieldKeys: string[] }) => {
  const { sorting } = view.config
  const used = new Set<TaskSortField>(sorting.map((sort) => sort.id))
  const available = [...taskSortFields, ...fieldKeys.map(toInlineFieldId)].filter((field) => !used.has(field))
  const setSorting = (next: TaskSort[]) => updateViewConfig(view.id, { sorting: next })

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) {
      return
    }
    const from = sorting.findIndex((sort) => sort.id === active.id)
    const to = sorting.findIndex((sort) => sort.id === over.id)
    setSorting(arrayMove(sorting, from, to))
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant='ghost'
            size='sm'
            data-active={sorting.length > 0}
            className={toolbarButtonClassName}
          />
        }
      >
        <ArrowUpDownIcon data-icon='inline-start' />
        <ToolbarLabel>Sort</ToolbarLabel>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-auto min-w-72 gap-2 p-2'>
        <div className='px-1 pt-1 text-sm font-medium'>Sort by</div>
        {sorting.length > 0 ? (
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sorting.map((sort) => sort.id)} strategy={verticalListSortingStrategy}>
              <ul className='flex flex-col gap-1'>
                {sorting.map((sort, index) => (
                  <SortRow
                    key={sort.id}
                    sort={sort}
                    available={available}
                    onChange={(next) => setSorting(sorting.map((item, at) => (at === index ? next : item)))}
                    onRemove={() => setSorting(sorting.filter((_, at) => at !== index))}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        ) : (
          <p className='px-1 text-sm text-muted-foreground'>Tasks keep the order of their notes.</p>
        )}
        {available.length > 0 ? (
          <Button
            variant='ghost'
            size='sm'
            className='justify-start text-muted-foreground'
            onClick={() => setSorting([...sorting, { id: available[0], desc: false }])}
          >
            <PlusIcon data-icon='inline-start' />
            Add sort
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
