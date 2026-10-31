import { taskFilterSchema, type TaskFilter } from '@shared/taskTypes'

// "is" and "is not" take one value; "is any of" and "is not any of" take several.
const singleValueOperators = new Set<string>(['is', 'is_not'])

// The filters as a view saves them. Filters that are not valid are left out, and
// a filter switched from "is any of" to "is" keeps only its first value.
export const toTaskFilters = (filters: unknown[]): TaskFilter[] =>
  filters.flatMap((filter) => {
    const result = taskFilterSchema.safeParse(filter)
    if (!result.success) {
      return []
    }
    const { data } = result
    return [singleValueOperators.has(data.operator) ? { ...data, values: data.values.slice(0, 1) } : data]
  })
