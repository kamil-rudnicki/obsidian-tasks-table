import { useState } from 'react'
import { Combobox as ComboboxPrimitive } from '@base-ui/react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { restrictToParentElement } from '@dnd-kit/modifiers'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PlusIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { Task } from '@shared/taskTypes'
import { TagBadge, tagColorClassName } from '@/components/TagBadge/TagBadge'
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from '@/components/ui/combobox'
import { tagOptionsQueryOptions } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { getTagColor, getTagEditorItems, toTagQuery } from '@/logic/tagLogic'
import { updateTask } from '@/logic/taskActions'
import { cellTriggerClassName } from './cellTriggerClassName'

// The order counts: the note writes the tags in the order the editor shows.
const hasSameTags = (first: string[], second: string[]): boolean =>
  first.length === second.length && first.every((tag, index) => tag === second[index])

type TagMove = -1 | 1

// A tag in the editor. Dragging it, or Alt with the left or right arrow key,
// moves it in the task's tags.
const SortableTagChip = ({ tag, onMove }: { tag: string; onMove: (tag: string, by: TagMove) => void }) => {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tag })

  return (
    <ComboboxChip
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-tag-color={getTagColor(tag)}
      data-dragging={isDragging || undefined}
      aria-keyshortcuts='Alt+ArrowLeft Alt+ArrowRight'
      className={cn(
        tagColorClassName,
        'cursor-grab rounded-(--tag-radius) font-normal data-dragging:z-10 data-dragging:cursor-grabbing data-dragging:shadow-sm',
      )}
      removeLabel={`Remove #${tag}`}
      {...listeners}
      onKeyDown={(event) => {
        if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
          event.preventDefault()
          event.preventBaseUIHandler()
          onMove(tag, event.key === 'ArrowLeft' ? -1 : 1)
        }
      }}
    >
      #{tag}
    </ComboboxChip>
  )
}

// Tags look like Obsidian's tag pills, each in its own color. Selecting the cell
// opens an editor that searches the vault's tags, adds new ones and reorders
// them. The note is written once, when the editor closes: the task's id changes
// with its tags.
export const TaskTagsCell = ({ task }: { task: Task }) => {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(task.tags)
  const [input, setInput] = useState('')
  const { data: options = [] } = useQuery({ ...tagOptionsQueryOptions(toTagQuery(input)), enabled: open })
  const { items, newTag } = getTagEditorItems(options, draft, input)
  const tags = open ? draft : task.tags
  // A press becomes a drag only after the pointer moves, so a click still
  // reaches the chip's remove button.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const moveTag = (tag: string, by: TagMove): void =>
    setDraft((current) => {
      const from = current.indexOf(tag)
      const to = from + by
      return to < 0 || to >= current.length ? current : arrayMove(current, from, to)
    })

  const handleDragEnd = ({ active, over }: DragEndEvent): void => {
    if (over && active.id !== over.id) {
      setDraft((current) => arrayMove(current, current.indexOf(String(active.id)), current.indexOf(String(over.id))))
    }
  }

  const handleOpenChange = (nextOpen: boolean): void => {
    if (nextOpen) {
      setDraft(task.tags)
      setInput('')
    } else if (!hasSameTags(draft, task.tags)) {
      void updateTask(task, { tags: draft })
    }
    setOpen(nextOpen)
  }

  return (
    <Combobox
      multiple
      items={items}
      // The vault search already filtered the tags.
      filter={null}
      value={draft}
      onValueChange={(next: string[]) => {
        setDraft(next)
        setInput('')
      }}
      inputValue={input}
      onInputValueChange={setInput}
      open={open}
      onOpenChange={handleOpenChange}
      autoHighlight
    >
      <ComboboxPrimitive.Trigger
        className={cn(cellTriggerClassName, 'gap-1 overflow-hidden')}
        aria-label={tags.length > 0 ? `Tags: ${tags.map((tag) => `#${tag}`).join(', ')}` : 'Add tags'}
      >
        {tags.map((tag) => (
          <TagBadge key={tag} tag={tag} />
        ))}
      </ComboboxPrimitive.Trigger>
      <ComboboxContent align='start' className='w-72'>
        <ComboboxChips className='rounded-none border-0 border-b px-2 py-1.5 focus-within:ring-0 dark:bg-transparent'>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToParentElement]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={draft} strategy={rectSortingStrategy}>
              <ComboboxValue>
                {(selected: string[]) =>
                  selected.map((tag) => <SortableTagChip key={tag} tag={tag} onMove={moveTag} />)
                }
              </ComboboxValue>
            </SortableContext>
          </DndContext>
          <ComboboxChipsInput
            aria-label='Search or add tags'
            placeholder={draft.length > 0 ? undefined : 'Search or add a tag'}
            className='h-6 bg-transparent text-sm'
          />
        </ComboboxChips>
        <ComboboxEmpty>{input.trim() === '' ? 'Type a name to add a tag' : 'A tag needs at least one letter'}</ComboboxEmpty>
        <ComboboxList>
          {(tag: string) => (
            <ComboboxItem key={tag} value={tag}>
              {tag === newTag ? (
                <>
                  <PlusIcon aria-hidden='true' className='text-muted-foreground' />
                  <span className='text-muted-foreground'>Add</span>
                </>
              ) : null}
              <TagBadge tag={tag} className='min-w-0 truncate' />
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
