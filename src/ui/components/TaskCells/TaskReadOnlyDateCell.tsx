import { formatTaskDate } from '@/logic/taskDisplayLogic'
import { useToday } from '@/logic/todayLogic'

export const TaskReadOnlyDateCell = ({ value }: { value: string | null }) => {
  const today = useToday()

  return value ? (
    <span className='block truncate text-muted-foreground tabular-nums'>
      {formatTaskDate(value, today)}
    </span>
  ) : null
}
