import { describe, expect, test } from 'vitest'
import { getTagColor, getTagEditorItems, tagColors, toTagName } from './tagLogic'

describe('getTagColor', () => {
  test('gives a tag the same color in any case', () => {
    expect(getTagColor('Work')).toBe(getTagColor('work'))
    expect(tagColors).toContain(getTagColor('work'))
  })

  test('spreads tags over the colors', () => {
    const colors = new Set(['work', 'home', 'type/task', 'errand', 'idea', 'urgent', 'read', 'call'].map(getTagColor))
    expect(colors.size).toBeGreaterThan(3)
  })
})

describe('toTagName', () => {
  test.each([
    ['home', 'home'],
    ['  #home ', 'home'],
    ['##work/project', 'work/project'],
    ['my tag', 'my-tag'],
    ['C++ ideas!', 'C-ideas'],
    ['zadanie_ąę', 'zadanie_ąę'],
    ['', null],
    ['#', null],
    ['2026', null],
    ['!?', null],
  ])('reads %s as %s', (input, tag) => {
    expect(toTagName(input)).toBe(tag)
  })
})

describe('getTagEditorItems', () => {
  const options = ['home', 'type/task', 'work']

  test('lists every tag by name without typed text', () => {
    expect(getTagEditorItems(options, ['new-one', 'Apple'], '')).toEqual({
      items: ['Apple', 'home', 'new-one', 'type/task', 'work'],
      newTag: null,
    })
  })

  test('lists matching tags and offers the typed tag', () => {
    expect(getTagEditorItems(options, [], '#Ho')).toEqual({ items: ['home', 'Ho'], newTag: 'Ho' })
    expect(getTagEditorItems(options, [], 'task')).toEqual({ items: ['type/task', 'task'], newTag: 'task' })
  })

  test('does not offer a tag that is already listed', () => {
    expect(getTagEditorItems(options, [], 'HOME')).toEqual({ items: ['home'], newTag: null })
    expect(getTagEditorItems(options, ['my-tag'], 'my tag')).toEqual({ items: ['my-tag'], newTag: null })
  })

  test('offers nothing for text that is not a tag', () => {
    expect(getTagEditorItems(options, [], '123')).toEqual({ items: [], newTag: null })
  })
})
