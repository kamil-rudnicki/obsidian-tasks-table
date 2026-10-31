import { taskStatuses, type Task, type TaskStatus } from '@shared/taskTypes'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { updateTask } from '@/logic/taskActions'
import { statusLabels } from '@/logic/taskLabels'
import { cellTriggerClassName } from './cellTriggerClassName'
import { TaskStatusIcon } from './TaskStatusIcon'

export const TaskStatusCell = ({ task }: { task: Task }) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      className={cellTriggerClassName}
      aria-label={`Status: ${statusLabels[task.status]}`}
    >
      <TaskStatusIcon status={task.status} />
      <span className='truncate'>{statusLabels[task.status]}</span>
    </DropdownMenuTrigger>
    <DropdownMenuContent align='start' className='w-40'>
      <DropdownMenuRadioGroup
        value={task.status}
        onValueChange={(status) => void updateTask(task, { status: status as TaskStatus })}
      >
        {taskStatuses.map((status) => (
          <DropdownMenuRadioItem key={status} value={status} closeOnClick>
            <TaskStatusIcon status={status} />
            {statusLabels[status]}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
)
