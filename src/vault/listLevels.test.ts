import { describe, expect, test } from 'vitest'
import { createListLevelReader } from './listLevels'

const readLevels = (lines: string[]): Array<number | null> => {
  const readLevel = createListLevelReader()
  return lines.map(readLevel)
}

describe('createListLevelReader', () => {
  test('gives nested list items a higher level', () => {
    expect(
      readLevels([
        '- [ ] Plan trip',
        '\t- [ ] Book hotel',
        '\t\t- [ ] Compare prices',
        '- [ ] Pack',
        '    - [ ] Charger',
      ]),
    ).toEqual([1, 2, 3, 1, 2])
  })

  test('counts bullets and numbered items as parents', () => {
    expect(readLevels(['- Groceries', '  - [ ] Milk', '1. Steps', '   1. [ ] First step'])).toEqual([
      1,
      2,
      1,
      2,
    ])
  })

  test('keeps a list open over blank lines and indented notes', () => {
    expect(readLevels(['- [ ] Task', '', '  Some notes', '  - [ ] Subtask'])).toEqual([1, null, null, 2])
  })

  test('starts again after text that is not indented', () => {
    expect(readLevels(['- [ ] Task', '  - [ ] Subtask', '## Next', '  - [ ] Indented, but first'])).toEqual([
      1,
      2,
      null,
      1,
    ])
  })

  test('reads lists inside blockquotes and callouts', () => {
    expect(
      readLevels(['- [ ] Outside', '> [!todo] Callout', '> - [ ] Inside', '>   - [ ] Nested', '> ', '>   - [ ] After a blank']),
    ).toEqual([1, null, 1, 2, null, 2])
  })
})
