import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent, type SubmitEvent } from 'react'
import { ArrowUpIcon, MessageSquareIcon } from 'lucide-react'
import { getToday } from '@shared/dateLogic'
import type { Task } from '@shared/taskTypes'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { addComment } from '@/logic/taskActions'
import { formatCommentTime, getDisplayValue } from '@/logic/taskDisplayLogic'
import { cellTriggerClassName } from './cellTriggerClassName'

const getCountLabel = (count: number): string => (count === 1 ? '1 comment' : `${count} comments`)

const scrollToEnd = (list: HTMLElement | null): void => {
  if (list) {
    list.scrollTop = list.scrollHeight
  }
}

// Shows how many comments the task has. Selecting the cell opens them, the
// newest last, above a field that adds one.
export const TaskCommentsCell = ({ task }: { task: Task }) => {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLOListElement | null>(null)
  const { comments } = task
  const today = getToday()

  // The newest comment shows when the list opens and when a comment is added.
  // The list mounts with the popup, after the popup's own effects.
  const attachList = useCallback((list: HTMLOListElement | null) => {
    listRef.current = list
    scrollToEnd(list)
  }, [])
  useLayoutEffect(() => scrollToEnd(listRef.current), [comments.length])

  const submit = (event?: SubmitEvent): void => {
    event?.preventDefault()
    const text = draft.trim()
    if (text === '') {
      return
    }
    setDraft('')
    // A comment that is not saved comes back into the field.
    void addComment(task, text).then((saved) => {
      if (!saved) {
        setDraft((current) => (current === '' ? text : current))
      }
    })
  }

  // A comment is one line in the note, so Enter adds it.
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cellTriggerClassName}
        aria-label={comments.length > 0 ? getCountLabel(comments.length) : 'Add a comment'}
      >
        {comments.length > 0 ? (
          <>
            <MessageSquareIcon aria-hidden='true' className='size-3.5 shrink-0 text-muted-foreground' />
            <span className='tabular-nums'>{comments.length}</span>
          </>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align='start' initialFocus={inputRef} className='w-80 gap-0 p-0'>
        {comments.length > 0 ? (
          <ol ref={attachList} aria-label='Comments' className='max-h-72 overflow-y-auto border-b py-1.5'>
            {comments.map((comment, index) => (
              <li key={`${index}:${comment.time}`} className='flex flex-col gap-0.5 px-3 py-1.5'>
                <time dateTime={comment.time} className='text-xs text-muted-foreground tabular-nums'>
                  {formatCommentTime(comment.time, today)}
                </time>
                <p className='wrap-break-word select-text'>{getDisplayValue(comment.text)}</p>
              </li>
            ))}
          </ol>
        ) : null}
        <form className='flex items-end gap-1 p-1.5' onSubmit={submit}>
          <Textarea
            ref={inputRef}
            rows={1}
            value={draft}
            aria-label='Comment'
            placeholder='Add a comment…'
            className='max-h-40 min-h-7 flex-1 resize-none rounded-none border-0 px-1.5 py-1 focus-visible:ring-0 dark:bg-transparent'
            onChange={(event) => setDraft(event.target.value.replace(/\r\n?|\n/gu, ' '))}
            onKeyDown={handleKeyDown}
          />
          <Button type='submit' size='icon-sm' aria-label='Add comment' disabled={draft.trim() === ''}>
            <ArrowUpIcon />
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
