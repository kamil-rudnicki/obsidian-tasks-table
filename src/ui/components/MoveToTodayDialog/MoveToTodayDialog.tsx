import { useRef } from 'react'
import { useSelector } from '@tanstack/react-store'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  answerMoveToToday,
  closeMoveToToday,
  moveToTodayStore,
  setRememberMoveToToday,
} from '@/logic/moveToTodayLogic'
import { getDialogTitle } from '@/logic/taskDisplayLogic'

// Asks to move a task you just completed or cancelled to today's daily note.
export const MoveToTodayDialog = () => {
  const { task, open, remember } = useSelector(moveToTodayStore, (state) => state)
  const moveButton = useRef<HTMLButtonElement>(null)

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && closeMoveToToday()}>
      {/* Enter moves the task: you asked for the move by closing it. */}
      <AlertDialogContent size='sm' initialFocus={moveButton}>
        <AlertDialogHeader>
          <AlertDialogTitle>Move to today’s daily note?</AlertDialogTitle>
          <AlertDialogDescription>
            {task
              ? `“${getDialogTitle(task.description)}” and its subtasks move from ${task.note} to today’s daily note.`
              : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Label className='justify-center font-normal text-muted-foreground'>
          <Checkbox checked={remember} onCheckedChange={setRememberMoveToToday} />
          Don’t ask again
        </Label>
        <AlertDialogFooter>
          {/* Not a close button: the answer is read before the dialog closes. */}
          <AlertDialogAction variant='outline' onClick={() => void answerMoveToToday(false)}>
            Keep in note
          </AlertDialogAction>
          <AlertDialogAction ref={moveButton} onClick={() => void answerMoveToToday(true)}>
            Move
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
