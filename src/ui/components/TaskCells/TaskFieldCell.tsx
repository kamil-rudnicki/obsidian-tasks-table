import { getDisplayValue } from '@/logic/taskDisplayLogic'

// The value of an inline field such as `[type:: work]`, as it reads in the note.
export const TaskFieldCell = ({ value }: { value: string | undefined }) =>
  value ? <span className='block truncate'>{getDisplayValue(value)}</span> : null
