import { useState } from 'react'
import { addDays, getToday, parseIsoDate, toIsoDate } from '@shared/dateLogic'
import type { Task } from '@shared/taskTypes'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { updateTask } from '@/logic/taskActions'
import { formatTaskDate, isOverdue } from '@/logic/taskDisplayLogic'
import { columnLabels } from '@/logic/taskLabels'
import { cellTriggerClassName } from './cellTriggerClassName'

type EditableDateField = 'dueDate' | 'scheduledDate' | 'startDate'

const getNextMonday = (today: string): string => {
  const day = parseIsoDate(today).getDay()
  return addDays(today, ((8 - day) % 7) || 7)
}

export const TaskDateCell = ({ task, field }: { task: Task; field: EditableDateField }) => {
  const [open, setOpen] = useState(false)
  const value = task[field]
  const today = getToday()
  const label = columnLabels[field]

  const setDate = (date: string | null): void => {
    setOpen(false)
    void updateTask(task, { [field]: date })
  }

  const shortcuts = [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: addDays(today, 1) },
    { label: 'Next week', date: getNextMonday(today) },
  ]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cellTriggerClassName}
        aria-label={value ? `${label}: ${formatTaskDate(value, today)}` : `Set ${label.toLowerCase()} date`}
      >
        {value ? (
          <span
            className={cn(
              'truncate tabular-nums',
              field === 'dueDate' && isOverdue(task, today) && 'text-destructive',
            )}
          >
            {formatTaskDate(value, today)}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align='start' className='w-auto gap-0 p-0'>
        <div className='flex gap-1 border-b p-2'>
          {shortcuts.map((shortcut) => (
            <Button
              key={shortcut.label}
              variant='ghost'
              size='sm'
              className='flex-1'
              onClick={() => setDate(shortcut.date)}
            >
              {shortcut.label}
            </Button>
          ))}
        </div>
        <Calendar
          mode='single'
          weekStartsOn={1}
          selected={value ? parseIsoDate(value) : undefined}
          defaultMonth={value ? parseIsoDate(value) : undefined}
          onSelect={(date) => {
            if (date) {
              setDate(toIsoDate(date))
            }
          }}
        />
        {value ? (
          <div className='border-t p-2'>
            <Button variant='ghost' size='sm' className='w-full' onClick={() => setDate(null)}>
              Remove {label.toLowerCase()} date
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
