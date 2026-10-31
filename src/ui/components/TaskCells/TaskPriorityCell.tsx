import { taskPriorities, type Task, type TaskPriority } from '@shared/taskTypes'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { updateTask } from '@/logic/taskActions'
import { priorityLabels } from '@/logic/taskLabels'
import { cellTriggerClassName } from './cellTriggerClassName'
import { TaskPriorityIcon } from './TaskPriorityIcon'

export const TaskPriorityCell = ({ task }: { task: Task }) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      className={cellTriggerClassName}
      aria-label={`Priority: ${priorityLabels[task.priority]}`}
    >
      {task.priority === 'normal' ? null : (
        <>
          <TaskPriorityIcon priority={task.priority} />
          <span className='truncate'>{priorityLabels[task.priority]}</span>
        </>
      )}
    </DropdownMenuTrigger>
    <DropdownMenuContent align='start' className='w-36'>
      <DropdownMenuRadioGroup
        value={task.priority}
        onValueChange={(priority) => void updateTask(task, { priority: priority as TaskPriority })}
      >
        {taskPriorities.map((priority) => (
          <DropdownMenuRadioItem key={priority} value={priority} closeOnClick>
            <TaskPriorityIcon priority={priority} />
            {priorityLabels[priority]}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
)
