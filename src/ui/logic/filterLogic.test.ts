import { describe, expect, test } from 'vitest'
import { toTaskFilters } from './filterLogic'

describe('toTaskFilters', () => {
  test('keeps several values for "is any of"', () => {
    const filter = { id: 'a', field: 'status', operator: 'is_any_of', values: ['todo', 'in_progress'] }
    expect(toTaskFilters([filter])).toEqual([filter])
  })

  test('keeps the first value when the operator takes one', () => {
    expect(
      toTaskFilters([
        { id: 'a', field: 'status', operator: 'is', values: ['todo', 'in_progress'] },
        { id: 'b', field: 'priority', operator: 'is_not', values: ['high', 'low'] },
      ]),
    ).toEqual([
      { id: 'a', field: 'status', operator: 'is', values: ['todo'] },
      { id: 'b', field: 'priority', operator: 'is_not', values: ['high'] },
    ])
  })

  test('leaves out filters that are not valid', () => {
    expect(toTaskFilters([{ id: 'a', field: 'unknown', operator: 'is', values: [] }, null])).toEqual([])
  })
})
