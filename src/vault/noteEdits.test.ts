import { describe, expect, test } from 'vitest'
import { getTaskBlock, insertTaskLines, locateLine, removeLines, replaceLine } from './noteEdits'

describe('insertTaskLines', () => {
  test('appends after the last content line and keeps the trailing newline', () => {
    expect(insertTaskLines('# Note\n- [ ] One\n\n', ['- [ ] Two'], '')).toEqual({
      content: '# Note\n- [ ] One\n- [ ] Two\n\n',
      line: 2,
    })
  })

  test('creates the first line of an empty note', () => {
    expect(insertTaskLines('', ['- [ ] One'], '')).toEqual({ content: '- [ ] One\n', line: 0 })
  })

  test('adds the task at the end of the matching section', () => {
    const content = '# Day\r\n## Inbox\r\n- [ ] A\r\n\r\n## Notes\r\ntext'
    expect(insertTaskLines(content, ['- [ ] B'], 'inbox')).toEqual({
      content: '# Day\r\n## Inbox\r\n- [ ] A\r\n- [ ] B\r\n\r\n## Notes\r\ntext',
      line: 3,
    })
  })

  test('keeps sub-headings inside the section', () => {
    expect(insertTaskLines('# Inbox\n### Later\n- [ ] A\n# Done\n', ['- [ ] B'], '# Inbox').line).toBe(3)
  })

  test('adds right after an empty section heading', () => {
    expect(insertTaskLines('# Inbox\n\n# Other\n', ['- [ ] B'], 'Inbox')).toEqual({
      content: '# Inbox\n- [ ] B\n\n# Other\n',
      line: 1,
    })
  })

  test('adds several lines in order', () => {
    expect(insertTaskLines('# Day\n', ['- [ ] A', '\t- [ ] B'], '')).toEqual({
      content: '# Day\n- [ ] A\n\t- [ ] B\n',
      line: 1,
    })
  })

  test('appends to the note when the heading is missing', () => {
    expect(insertTaskLines('text', ['- [ ] B'], 'Inbox')).toEqual({ content: 'text\n- [ ] B', line: 1 })
  })
})

describe('replaceLine', () => {
  test('replaces and removes lines without touching line endings', () => {
    expect(replaceLine('a\r\nb\r\nc\r\n', 1, 'B')).toBe('a\r\nB\r\nc\r\n')
    expect(replaceLine('a\nb\nc', 1, null)).toBe('a\nc')
  })
})

describe('locateLine', () => {
  test('finds the nearest equal line when the note moved', () => {
    expect(locateLine('x\n- [ ] A\ny', 1, '- [ ] A')).toBe(1)
    expect(locateLine('- [ ] A\nx\nx\nx\n- [ ] A', 3, '- [ ] A')).toBe(4)
    expect(locateLine('x', 0, '- [ ] A')).toBeNull()
  })
})

describe('getTaskBlock', () => {
  test('takes nested subtasks and notes, also across blank lines', () => {
    const content = ['- [ ] A', '\t- [ ] A1', '\t  note', '', '\t- [ ] A2', '- [ ] B'].join('\n')
    expect(getTaskBlock(content, 0)).toEqual({
      start: 0,
      end: 5,
      lines: ['- [ ] A', '\t- [ ] A1', '\t  note', '', '\t- [ ] A2'],
    })
  })

  test('stops at a blank line that no nested line follows', () => {
    expect(getTaskBlock('- [ ] A\n\n- [ ] B', 0)).toEqual({ start: 0, end: 1, lines: ['- [ ] A'] })
  })

  test('removes the nesting of a subtask or a callout', () => {
    expect(getTaskBlock('- [ ] A\n\t- [ ] A1\n\t\t- [ ] A1a\n\t- [ ] A2', 1).lines).toEqual([
      '- [ ] A1',
      '\t- [ ] A1a',
    ])
    expect(getTaskBlock('> - [ ] Q\n>   more\n> - [ ] R', 0).lines).toEqual(['- [ ] Q', '  more'])
  })
})

describe('removeLines', () => {
  test('removes a block and keeps line endings', () => {
    expect(removeLines('a\r\nb\r\nc\r\nd\r\n', 1, 3)).toBe('a\r\nd\r\n')
  })
})
