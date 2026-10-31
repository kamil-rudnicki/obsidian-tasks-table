import type { Task } from '@shared/taskTypes'
import { Checkbox } from '@/components/ui/checkbox'
import { updateTask } from '@/logic/taskActions'

export const TaskCompleteCell = ({ task }: { task: Task }) => (
  <div className='flex items-center justify-center'>
    <Checkbox
      className='border-foreground/30 data-checked:border-checkbox data-checked:bg-checkbox data-checked:text-checkbox-foreground dark:data-checked:bg-checkbox'
      checked={task.status === 'done'}
      aria-label={task.status === 'done' ? 'Mark as not done' : 'Mark as done'}
      onCheckedChange={(checked) => void updateTask(task, { status: checked ? 'done' : 'todo' })}
    />
  </div>
)
