import { describe, expect, test } from 'vitest'
import { viewConfigSchema } from './viewTypes'

const baseConfig = { filters: [], sorting: [], columnVisibility: {}, columnOrder: [], columnSizing: {} }

describe('viewConfigSchema', () => {
  test('reads views saved before grouping', () => {
    expect(viewConfigSchema.parse(baseConfig)).toMatchObject({ grouping: [], collapsedGroups: [] })
    expect(viewConfigSchema.parse({ ...baseConfig, grouping: null })).toMatchObject({ grouping: [] })
  })

  test('reads views saved with one grouping level', () => {
    expect(viewConfigSchema.parse({ ...baseConfig, grouping: { field: 'status', desc: false } }).grouping).toEqual([
      { field: 'status', desc: false },
    ])
  })

  test('takes up to two levels', () => {
    const levels = [
      { field: 'status', desc: false },
      { field: 'priority', desc: true },
    ]
    expect(viewConfigSchema.parse({ ...baseConfig, grouping: levels }).grouping).toEqual(levels)
    expect(viewConfigSchema.safeParse({ ...baseConfig, grouping: [...levels, { field: 'tags', desc: false }] }).success).toBe(
      false,
    )
  })
})
