import { describe, expect, test } from 'vitest'
import { getColumnOrder, getColumnVisibility } from './fieldColumnsLogic'

describe('field columns', () => {
  test('start hidden unless the view shows them', () => {
    expect(getColumnVisibility({ folder: false, 'field:type': true }, ['type', 'id'])).toEqual({
      links: false,
      'field:type': true,
      'field:id': false,
      folder: false,
    })
  })

  test('put a built-in column new to a saved view after its default neighbour', () => {
    expect(getColumnOrder(['description', 'note', 'tags', 'actions'], ['description', 'tags', 'links', 'note', 'actions'])).toEqual([
      'description',
      'note',
      'tags',
      'links',
      'actions',
    ])
  })

  test('go before the actions column, which stays last', () => {
    expect(
      getColumnOrder(['complete', 'description', 'actions', 'field:old'], ['complete', 'description', 'field:type', 'actions']),
    ).toEqual(['complete', 'description', 'field:type', 'actions'])
  })
})
