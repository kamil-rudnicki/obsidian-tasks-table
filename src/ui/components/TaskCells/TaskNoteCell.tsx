import type { Task } from '@shared/taskTypes'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { openTask } from '@/logic/taskActions'

// Looks like an internal link, as file names do in Bases.
export const TaskNoteCell = ({ task }: { task: Task }) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <button
          type='button'
          className='block max-w-full truncate rounded-sm text-start text-link underline decoration-link/40 underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [@media(hover:hover)]:hover:text-link-hover [@media(hover:hover)]:hover:decoration-link-hover'
        />
      }
      onClick={(event) => void openTask(task, event.metaKey || event.ctrlKey ? 'split' : 'tab')}
    >
      {task.note}
    </TooltipTrigger>
    <TooltipContent>{task.filePath}</TooltipContent>
  </Tooltip>
)
