import type { TaskPriority, TaskStatus } from './taskTypes'

// Sorting and grouping share these ranks. Priority groups put Normal first.

export const statusRanks: Record<TaskStatus, number> = {
  in_progress: 0,
  todo: 1,
  later: 2,
  done: 3,
  cancelled: 4,
}

// Higher is more urgent, so sorting by priority descending lists urgent tasks first.
export const priorityRanks: Record<TaskPriority, number> = {
  lowest: 0,
  low: 1,
  normal: 2,
  medium: 3,
  high: 4,
  highest: 5,
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

// Text without case and with numbers by value; numbers by size.
export const compareValues = (first: string | number, second: string | number): number =>
  typeof first === 'string' && typeof second === 'string'
    ? collator.compare(first, second)
    : first < second
      ? -1
      : first > second
        ? 1
        : 0
