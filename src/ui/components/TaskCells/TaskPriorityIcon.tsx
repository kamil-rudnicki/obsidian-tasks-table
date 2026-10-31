import { FlagIcon } from 'lucide-react'
import type { TaskPriority } from '@shared/taskTypes'
import { cn } from '@/lib/utils'

const priorityClassNames: Record<TaskPriority, string> = {
  highest: 'fill-priority-highest text-priority-highest',
  high: 'text-priority-high',
  medium: 'text-priority-medium',
  normal: 'text-muted-foreground',
  low: 'text-priority-low',
  lowest: 'text-priority-lowest',
}

export const TaskPriorityIcon = ({ priority, className }: { priority: TaskPriority; className?: string }) => (
  <FlagIcon aria-hidden='true' className={cn('size-3.5 shrink-0', priorityClassNames[priority], className)} />
)
