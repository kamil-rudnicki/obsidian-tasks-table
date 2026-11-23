import { createStore, useSelector } from '@tanstack/react-store'
import { getToday } from '@shared/dateLogic'

// The day the table shows dates against. Rows are memoized, so a component
// that shows "Today" or an overdue date reads it from here to change with the day.
export const todayStore = createStore(getToday())

export const setToday = (today: string): void => {
  todayStore.setState(() => today)
}

export const useToday = (): string => useSelector(todayStore, (today) => today)
