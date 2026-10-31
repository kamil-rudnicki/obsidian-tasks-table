import { useState } from 'react'
import { Combobox as ComboboxPrimitive } from '@base-ui/react'
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

const hasSameTags = (first: string[], second: string[]): boolean =>
  first.length === second.length && first.every((tag) => second.includes(tag))

// Tags look like Obsidian's tag pills, each in its own color. Selecting the cell
// opens an editor that searches the vault's tags and adds new ones. The note is
// written once, when the editor closes: the task's id changes with its tags.
export const TaskTagsCell = ({ task }: { task: Task }) => {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(task.tags)
  const [input, setInput] = useState('')
  const { data: options = [] } = useQuery({ ...tagOptionsQueryOptions(toTagQuery(input)), enabled: open })
  const { items, newTag } = getTagEditorItems(options, draft, input)
  const tags = open ? draft : task.tags

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
          <ComboboxValue>
            {(selected: string[]) =>
              selected.map((tag) => (
                <ComboboxChip
                  key={tag}
                  data-tag-color={getTagColor(tag)}
                  className={cn(tagColorClassName, 'rounded-(--tag-radius) font-normal')}
                  removeLabel={`Remove #${tag}`}
                >
                  #{tag}
                </ComboboxChip>
              ))
            }
          </ComboboxValue>
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
