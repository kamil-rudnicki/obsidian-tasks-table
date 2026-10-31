import { getToday } from '@shared/dateLogic'
import { formatTaskDate } from '@/logic/taskDisplayLogic'

export const TaskReadOnlyDateCell = ({ value }: { value: string | null }) =>
  value ? (
    <span className='block truncate text-muted-foreground tabular-nums'>
      {formatTaskDate(value, getToday())}
    </span>
  ) : null
