import { useSelector } from '@tanstack/react-store'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cancelTaskDelete, confirmTaskDelete, deleteTaskStore } from '@/logic/deleteTaskLogic'
import { getDisplayTitle } from '@/logic/taskDisplayLogic'

export const DeleteTaskDialog = () => {
  const task = useSelector(deleteTaskStore, (state) => state.task)

  return (
    <AlertDialog open={task !== null} onOpenChange={(open) => !open && cancelTaskDelete()}>
      <AlertDialogContent size='sm'>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this task?</AlertDialogTitle>
          <AlertDialogDescription>
            {task
              ? `“${getDisplayTitle(task.description)}” is removed from the note ${task.note}.`
              : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant='destructive' onClick={() => void confirmTaskDelete()}>
            Delete task
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
