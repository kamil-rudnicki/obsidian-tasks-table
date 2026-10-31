import { optionalColumnIds, taskColumnIds } from '@shared/taskColumns'
import { toInlineFieldId } from '@shared/taskTypes'

// Columns for inline fields start hidden: a vault can use many fields, and a
// view shows only the ones turned on in Properties. So do optional columns
// that a view saved before they existed does not know.
export const getColumnVisibility = (
  saved: Record<string, boolean>,
  fieldKeys: string[],
): Record<string, boolean> => ({
  ...Object.fromEntries(optionalColumnIds.map((id) => [id, false])),
  ...Object.fromEntries(fieldKeys.map((key) => [toInlineFieldId(key), false])),
  ...saved,
})

const defaultOrder: readonly string[] = taskColumnIds

// Columns that the saved order does not name yet go where a new view has them:
// a built-in column after the column before it by default, such as Links after
// Tags, and a field used for the first time before the actions column, which
// always stays last.
export const getColumnOrder = (saved: string[], columnIds: string[]): string[] => {
  const order = saved.filter((id) => id !== 'actions' && columnIds.includes(id))

  for (const id of columnIds) {
    if (id === 'actions' || order.includes(id)) {
      continue
    }
    let previous = -1
    for (let index = defaultOrder.indexOf(id) - 1; index >= 0 && previous === -1; index -= 1) {
      previous = order.indexOf(defaultOrder[index])
    }
    if (previous === -1) {
      order.push(id)
    } else {
      order.splice(previous + 1, 0, id)
    }
  }

  return [...order, 'actions']
}
