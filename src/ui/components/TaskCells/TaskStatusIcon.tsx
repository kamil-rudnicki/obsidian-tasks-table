import { CircleCheckIcon, CircleDotIcon, CircleIcon, CircleXIcon, ClockIcon, type LucideIcon } from 'lucide-react'
import type { TaskStatus } from '@shared/taskTypes'
import { cn } from '@/lib/utils'

const statusIcons: Record<TaskStatus, LucideIcon> = {
  todo: CircleIcon,
  in_progress: CircleDotIcon,
  later: ClockIcon,
  done: CircleCheckIcon,
  cancelled: CircleXIcon,
}

const statusIconClassNames: Record<TaskStatus, string> = {
  todo: 'text-muted-foreground',
  in_progress: 'text-status-in-progress',
  later: 'text-muted-foreground',
  done: 'text-status-done',
  cancelled: 'text-muted-foreground',
}

export const TaskStatusIcon = ({ status, className }: { status: TaskStatus; className?: string }) => {
  const Icon = statusIcons[status]
  return <Icon aria-hidden='true' className={cn('size-4 shrink-0', statusIconClassNames[status], className)} />
}
