import { Platform } from 'obsidian'
import {
  AsteriskIcon,
  Columns2Icon,
  EllipsisIcon,
  ExternalLinkIcon,
  ScissorsIcon,
  SparklesIcon,
  Trash2Icon,
} from 'lucide-react'
import type { Task } from '@shared/taskTypes'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { requestTaskDelete } from '@/logic/deleteTaskLogic'
import { cutTask, openTask, openTaskInChat } from '@/logic/taskActions'

export const TaskActionsCell = ({ task }: { task: Task }) => (
  <div className='flex items-center justify-center'>
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant='ghost'
            size='icon-xs'
            aria-label='Task actions'
            className='opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100'
          />
        }
      >
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-48'>
        <DropdownMenuItem onClick={() => void openTask(task, 'tab')}>
          <ExternalLinkIcon />
          Open note
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void openTask(task, 'split')}>
          <Columns2Icon />
          Open note to the right
        </DropdownMenuItem>
        {/* The ChatGPT and Claude desktop apps run on computers only. */}
        {Platform.isDesktopApp ? (
          <>
            <DropdownMenuItem onClick={() => void openTaskInChat(task, 'chatgpt')}>
              <SparklesIcon />
              Run ChatGPT Desktop
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void openTaskInChat(task, 'claude')}>
              <AsteriskIcon />
              Run Claude Desktop
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void cutTask(task)}>
          <ScissorsIcon />
          Cut task
        </DropdownMenuItem>
        <DropdownMenuItem variant='destructive' onClick={() => requestTaskDelete(task)}>
          <Trash2Icon />
          Delete task…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
)
