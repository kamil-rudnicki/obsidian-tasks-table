import { useLayoutEffect, useRef, useState, type KeyboardEvent, type SubmitEvent } from 'react'
import { ArrowUpRightIcon, PencilIcon } from 'lucide-react'
import type { Task, TaskComment } from '@shared/taskTypes'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { editComment } from '@/logic/taskActions'
import { formatCommentTime, getCommentParts } from '@/logic/taskDisplayLogic'

const commentLinkClassName =
  'rounded-sm text-link underline decoration-link/40 underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [@media(hover:hover)]:hover:text-link-hover [@media(hover:hover)]:hover:decoration-link-hover'

// Links stay ready to open while the comment is not being edited.
const CommentText = ({ text }: { text: string }) => (
  <p className='wrap-break-word select-text'>
    {getCommentParts(text).map((part, index) =>
      part.url ? (
        <a key={index} href={part.url} target='_blank' rel='noopener noreferrer' className={commentLinkClassName}>
          {part.text}
          <ArrowUpRightIcon aria-hidden='true' className='ms-0.5 inline-block size-3 align-[-1px]' />
        </a>
      ) : (
        <span key={index}>{part.text}</span>
      ),
    )}
  </p>
)

type CommentEditorProps = {
  taskId: string
  index: number
  original: TaskComment
  onFinish: () => void
}

const CommentEditor = ({ taskId, index, original, onFinish }: CommentEditorProps) => {
  const [draft, setDraft] = useState(original.text)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    inputRef.current?.focus()
  }, [])

  const save = async (): Promise<void> => {
    const text = draft.trim()
    if (saving || text === '') {
      return
    }
    if (text === original.text) {
      onFinish()
      return
    }
    setSaving(true)
    const saved = await editComment({ id: taskId, index, original, text })
    if (saved) {
      onFinish()
    } else {
      setSaving(false)
    }
  }

  const submit = (event: SubmitEvent): void => {
    event.preventDefault()
    void save()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.nativeEvent.isComposing) {
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      void save()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      if (!saving) {
        onFinish()
      }
    }
  }

  return (
    <form className='flex flex-col gap-2 py-1' onSubmit={submit}>
      <Textarea
        ref={inputRef}
        rows={2}
        aria-label='Edit comment'
        maxLength={5000}
        value={draft}
        disabled={saving}
        className='max-h-40 min-h-14 resize-none'
        onChange={(event) => setDraft(event.target.value.replace(/\r\n?|\n/gu, ' '))}
        onKeyDown={handleKeyDown}
      />
      <div className='flex justify-end gap-1'>
        <Button type='button' variant='ghost' size='sm' disabled={saving} onClick={onFinish}>
          Cancel
        </Button>
        <Button type='submit' size='sm' aria-label='Save comment' disabled={saving || draft.trim() === ''}>
          Save
        </Button>
      </div>
    </form>
  )
}

type TaskCommentItemProps = {
  taskId: Task['id']
  comment: TaskComment
  index: number
  today: string
}

export const TaskCommentItem = ({ taskId, comment, index, today }: TaskCommentItemProps) => {
  // Keep the original from when editing began, even if the note changes meanwhile.
  const [editing, setEditing] = useState<TaskComment | null>(null)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(false)

  useLayoutEffect(() => {
    if (editing === null && wasEditing.current) {
      editButtonRef.current?.focus()
    }
    wasEditing.current = editing !== null
  }, [editing])

  return (
    <li className='group/comment flex flex-col gap-0.5 px-3 py-1.5'>
      <div className='flex min-h-6 items-center justify-between gap-2'>
        <time dateTime={comment.time} className='text-xs text-muted-foreground tabular-nums'>
          {formatCommentTime(comment.time, today)}
        </time>
        {editing === null ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  ref={editButtonRef}
                  variant='ghost'
                  size='icon-sm'
                  aria-label='Edit comment'
                  className='size-6 text-muted-foreground opacity-0 group-hover/comment:opacity-100 group-focus-within/comment:opacity-100 [@media(hover:none)]:opacity-100'
                  onClick={() => setEditing(comment)}
                />
              }
            >
              <PencilIcon aria-hidden='true' className='size-3.5' />
            </TooltipTrigger>
            <TooltipContent>Edit comment</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      {editing ? (
        <CommentEditor taskId={taskId} index={index} original={editing} onFinish={() => setEditing(null)} />
      ) : (
        <CommentText text={comment.text} />
      )}
    </li>
  )
}
