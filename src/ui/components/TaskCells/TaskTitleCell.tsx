import type { Task } from '@shared/taskTypes'
import { cn } from '@/lib/utils'
import { getDisplayTitle, isOpenTask } from '@/logic/taskDisplayLogic'

export const TaskTitleCell = ({ task }: { task: Task }) => (
  <span
    className={cn(
      'block truncate',
      !isOpenTask(task) && 'text-muted-foreground line-through decoration-muted-foreground/40',
    )}
  >
    {getDisplayTitle(task.description)}
  </span>
)
