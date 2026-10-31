import { ArrowUpRightIcon } from 'lucide-react'
import type { Task, TaskLink } from '@shared/taskTypes'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { openTaskLink } from '@/logic/taskActions'

// Looks like an internal link, as note names do in Bases.
const linkClassName =
  'inline-flex max-w-48 shrink-0 items-center gap-0.5 rounded-sm text-link underline decoration-link/40 underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [@media(hover:hover)]:hover:text-link-hover [@media(hover:hover)]:hover:decoration-link-hover'

const LinkItem = ({ task, link }: { task: Task; link: TaskLink }) => (
  <Tooltip>
    <TooltipTrigger
      render={
        link.external ? (
          // Obsidian opens web addresses in the browser.
          <a href={link.target} target='_blank' rel='noopener noreferrer' className={linkClassName} />
        ) : (
          <button
            type='button'
            className={linkClassName}
            onClick={(event) => void openTaskLink(task, link, event.metaKey || event.ctrlKey ? 'split' : 'tab')}
          />
        )
      }
    >
      <span className='truncate'>{link.text}</span>
      {link.external ? <ArrowUpRightIcon aria-hidden='true' className='size-3 shrink-0' /> : null}
    </TooltipTrigger>
    <TooltipContent>{link.target}</TooltipContent>
  </Tooltip>
)

// Every link in the task: notes open in Obsidian, web addresses in the browser.
export const TaskLinksCell = ({ task }: { task: Task }) => (
  <div className='flex min-w-0 items-center gap-2 overflow-hidden'>
    {task.links.map((link) => (
      <LinkItem key={link.target} task={task} link={link} />
    ))}
  </div>
)
