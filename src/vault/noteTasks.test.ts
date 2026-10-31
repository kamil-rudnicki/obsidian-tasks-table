import { describe, expect, test } from 'vitest'
import { createTaskId, getNoteFolder, getNoteName, parseNoteTasks } from './noteTasks'

describe('parseNoteTasks', () => {
  test('indexes tasks with their line, note and folder', () => {
    const tasks = parseNoteTasks(
      'periodic/daily/2026-10-31.md',
      '# Inbox\r\n- [ ] First #work\r\ntext\r\n\t- [x] Second ✅ 2026-10-30\r\n',
    )

    expect(tasks).toHaveLength(2)
    expect(tasks[0]).toMatchObject({
      note: '2026-10-31',
      folder: 'periodic/daily',
      line: 1,
      raw: '- [ ] First #work',
      description: 'First #work',
      tags: ['work'],
    })
    expect(tasks[1]).toMatchObject({ line: 3, status: 'done', doneDate: '2026-10-30' })
  })

  test('skips frontmatter, fenced code and empty tasks', () => {
    const tasks = parseNoteTasks(
      'note.md',
      ['---', 'tags: [a]', '- [ ] not a task', '---', '```md', '- [ ] code', '```', '- [ ]', '- [ ] Real'].join('\n'),
    )

    expect(tasks.map((task) => task.description)).toEqual(['Real'])
    expect(tasks[0].line).toBe(8)
  })

  test('gives equal tasks in one note different ids', () => {
    const tasks = parseNoteTasks('note.md', '- [ ] Same\n- [x] Same')

    expect(tasks[0].id).toBe(createTaskId('note.md', 'Same', 0))
    expect(tasks[1].id).toBe(createTaskId('note.md', 'Same', 1))
  })

  test('reads how deep each task is nested', () => {
    const tasks = parseNoteTasks(
      'note.md',
      ['- [ ] Trip', '\t- [ ] Hotel', '\t\t- [ ] Prices', '- Groceries', '  - [ ] Milk', '> - [ ] Quoted'].join('\n'),
    )

    expect(tasks.map((task) => [task.description, task.level])).toEqual([
      ['Trip', 1],
      ['Hotel', 2],
      ['Prices', 3],
      ['Milk', 2],
      ['Quoted', 1],
    ])
  })

  test('keeps the id when the status or metadata changes', () => {
    const [before] = parseNoteTasks('note.md', '- [ ] Call')
    const [after] = parseNoteTasks('note.md', '- [x] Call ⏫ ✅ 2026-10-31')

    expect(after.id).toBe(before.id)
  })
})

describe('note paths', () => {
  test('reads the note name and folder', () => {
    expect(getNoteName('a/b/✅ tasks.md')).toBe('✅ tasks')
    expect(getNoteFolder('a/b/note.md')).toBe('a/b')
    expect(getNoteFolder('note.md')).toBe('')
  })
})
