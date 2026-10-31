import { describe, expect, test } from 'vitest'
import type { TaskFilter, TaskListQuery } from '@shared/taskTypes'
import { parseNoteTasks } from './noteTasks'
import { TaskIndex } from './taskIndex'
import type { TaskQueryContext } from './taskQuery'

const today = '2026-10-31'

// Notes in periodic/daily named YYYY-MM-DD are daily notes.
const context: TaskQueryContext = {
  getDailyNoteDate: (filePath) => /^periodic\/daily\/(\d{4}-\d{2}-\d{2})\.md$/u.exec(filePath)?.[1] ?? null,
}

const createIndex = () => {
  const index = new TaskIndex()
  const notes: Record<string, string> = {
    'periodic/daily/2026-10-30.md': [
      '- [ ] Pay rent ⏫ 📅 2026-10-30 #home',
      '- [/] Write report [priority:: high] [due:: 2026-10-31] #work/report',
      '- [x] Żółw feeding ✅ 2026-10-29 #home',
    ].join('\n'),
    'projects/app.md': [
      '- [ ] Ship 100% beta 📅 2026-11-03 #work',
      '- [ ] Plan v2 🔽',
      '- [-] Old idea ❌ 2026-10-01',
    ].join('\n'),
    'notes/no-tasks.md': '# Just text',
  }

  for (const [path, content] of Object.entries(notes)) {
    index.replaceNoteTasks({ path, mtimeMs: 1, size: content.length }, parseNoteTasks(path, content))
  }

  const list = (filters: Array<Omit<TaskFilter, 'id'>>, extra: Partial<TaskListQuery> = {}) =>
    index
      .listTasks(
        {
          filters: filters.map((filter, position) => ({ id: String(position), ...filter })),
          sorting: [],
          search: '',
          ...extra,
        },
        today,
        context,
      )
      .map((task) => task.description.split(' #')[0])

  return { index, list }
}

describe('task index', () => {
  test('lists every task in note order without filters', () => {
    const { list } = createIndex()

    expect(list([])).toEqual([
      'Pay rent',
      'Write report',
      'Żółw feeding',
      'Ship 100% beta',
      'Plan v2',
      'Old idea',
    ])
  })

  test('filters by status, priority, note and folder', () => {
    const { list } = createIndex()

    expect(list([{ field: 'status', operator: 'is_any_of', values: ['todo', 'in_progress'] }])).toEqual([
      'Pay rent',
      'Write report',
      'Ship 100% beta',
      'Plan v2',
    ])
    expect(list([{ field: 'priority', operator: 'is_not', values: ['normal'] }])).toEqual([
      'Pay rent',
      'Write report',
      'Plan v2',
    ])
    expect(list([{ field: 'note', operator: 'is', values: ['app'] }])).toHaveLength(3)
    expect(list([{ field: 'folder', operator: 'contains', values: ['daily'] }])).toHaveLength(3)
  })

  test('ignores filters without values', () => {
    const { list } = createIndex()

    expect(list([{ field: 'status', operator: 'is', values: [] }])).toHaveLength(6)
  })

  test('matches text without case, also outside ASCII', () => {
    const { list } = createIndex()

    expect(list([{ field: 'description', operator: 'contains', values: ['ŻÓŁW'] }])).toEqual([
      'Żółw feeding',
    ])
    expect(list([{ field: 'description', operator: 'contains', values: ['100%'] }])).toEqual([
      'Ship 100% beta',
    ])
    expect(list([{ field: 'description', operator: 'contains', values: ['0_'] }])).toEqual([])
    expect(list([{ field: 'description', operator: 'not_contains', values: ['a'] }])).toEqual([
      'Write report',
      'Żółw feeding',
    ])
    expect(list([], { search: 'APP' })).toHaveLength(3)
  })

  test('filters dates by relative buckets', () => {
    const { list } = createIndex()

    expect(list([{ field: 'dueDate', operator: 'is', values: ['past'] }])).toEqual(['Pay rent'])
    expect(list([{ field: 'dueDate', operator: 'is_any_of', values: ['today', 'next_7_days'] }])).toEqual([
      'Write report',
      'Ship 100% beta',
    ])
    expect(list([{ field: 'dueDate', operator: 'is_not', values: ['today'] }])).toHaveLength(5)
    expect(list([{ field: 'dueDate', operator: 'empty', values: [] }])).toHaveLength(3)
    expect(list([{ field: 'doneDate', operator: 'is', values: ['last_7_days'] }])).toEqual(['Żółw feeding'])
  })

  test('filters by the day of the daily note', () => {
    const { list } = createIndex()
    const daily = ['Pay rent', 'Write report', 'Żółw feeding']

    expect(list([{ field: 'dailyNote', operator: 'is_any_of', values: ['any'] }])).toEqual(daily)
    expect(list([{ field: 'dailyNote', operator: 'is_any_of', values: ['yesterday'] }])).toEqual(daily)
    expect(list([{ field: 'dailyNote', operator: 'is_any_of', values: ['today'] }])).toEqual([])
    expect(list([{ field: 'dailyNote', operator: 'is_not_any_of', values: ['any'] }])).toEqual([
      'Ship 100% beta',
      'Plan v2',
      'Old idea',
    ])
  })

  test('filters tags including nested tags', () => {
    const { list } = createIndex()

    expect(list([{ field: 'tags', operator: 'is_any_of', values: ['work'] }])).toEqual([
      'Write report',
      'Ship 100% beta',
    ])
    expect(list([{ field: 'tags', operator: 'includes_all', values: ['home', 'work'] }])).toEqual([])
    expect(list([{ field: 'tags', operator: 'excludes_all', values: ['home'] }])).toHaveLength(4)
    expect(list([{ field: 'tags', operator: 'empty', values: [] }])).toEqual(['Plan v2', 'Old idea'])
  })

  test('sorts with empty dates last and priority from most urgent', () => {
    const { list } = createIndex()

    expect(list([], { sorting: [{ id: 'dueDate', desc: true }] }).slice(0, 4)).toEqual([
      'Ship 100% beta',
      'Write report',
      'Pay rent',
      'Żółw feeding',
    ])
    expect(list([], { sorting: [{ id: 'priority', desc: true }] }).slice(0, 2)).toEqual([
      'Pay rent',
      'Write report',
    ])
    expect(list([], { sorting: [{ id: 'status', desc: false }] })[0]).toBe('Write report')
  })

  test('sorts by tags with untagged tasks last', () => {
    const { list } = createIndex()

    expect(list([], { sorting: [{ id: 'tags', desc: false }] })).toEqual([
      'Pay rent',
      'Żółw feeding',
      'Ship 100% beta',
      'Write report',
      'Plan v2',
      'Old idea',
    ])
    expect(list([], { sorting: [{ id: 'tags', desc: true }] })).toEqual([
      'Write report',
      'Ship 100% beta',
      'Pay rent',
      'Żółw feeding',
      'Plan v2',
      'Old idea',
    ])
  })

  test('reports whether a note changed, removes notes and counts notes with tasks', () => {
    const { index } = createIndex()
    const content = '- [ ] Plan v2 🔽'
    const note = { path: 'projects/app.md', mtimeMs: 2, size: 1 }

    expect(index.getCounts()).toEqual({ taskCount: 6, noteCount: 2 })
    expect(index.replaceNoteTasks(note, parseNoteTasks(note.path, content))).toBe(true)
    expect(index.replaceNoteTasks(note, parseNoteTasks(note.path, content))).toBe(false)
    expect(index.getCounts()).toEqual({ taskCount: 4, noteCount: 2 })
    expect(index.deleteNotes(['projects/app.md'])).toBe(true)
    expect(index.getCounts()).toEqual({ taskCount: 3, noteCount: 1 })
  })

  test('lists filter options', () => {
    const { index } = createIndex()

    expect(index.listOptions({ field: 'tags', search: '' })).toEqual(['home', 'work', 'work/report'])
    expect(index.listOptions({ field: 'tags', search: 'WORK/' })).toEqual(['work/report'])
    expect(index.listOptions({ field: 'note', search: '' })).toEqual(['app', '2026-10-30'])
    expect(index.listOptions({ field: 'folder', search: 'per' })).toEqual(['periodic/daily'])
  })

  test('lists every tag by name, numbers by value', () => {
    const index = new TaskIndex()
    const tags = Array.from({ length: 60 }, (_, number) => `#tag/${number}m`)
    const content = `- [ ] Many ${tags.join(' ')} #Work #apple`
    index.replaceNoteTasks({ path: 'tags.md', mtimeMs: 1, size: content.length }, parseNoteTasks('tags.md', content))

    const options = index.listOptions({ field: 'tags', search: '' })
    expect(options).toHaveLength(62)
    expect(options.slice(0, 4)).toEqual(['apple', 'tag/0m', 'tag/1m', 'tag/2m'])
    expect(options.slice(-2)).toEqual(['tag/59m', 'Work'])
  })
})

describe('inline fields', () => {
  const createFieldIndex = () => {
    const index = new TaskIndex()
    const content = [
      '- [ ] Email admin [type:: work] [estimate:: 10]',
      '- [ ] Fix sink [type:: Home] [estimate:: 2]',
      '- [ ] Plan trip [type:: home]',
      '- [ ] Read book',
    ].join('\n')
    index.replaceNoteTasks({ path: 'inbox.md', mtimeMs: 1, size: 1 }, parseNoteTasks('inbox.md', content))
    const list = (query: Partial<TaskListQuery>) =>
      index
        .listTasks({ filters: [], sorting: [], search: '', ...query }, today, context)
        .map((task) => task.description.split(' [')[0])
    return { index, list }
  }

  test('filters by value without case, and by empty fields', () => {
    const { list } = createFieldIndex()
    const filter = (operator: TaskFilter['operator'], values: string[]) => ({
      filters: [{ id: '1', field: 'field:type' as const, operator, values }],
    })

    expect(list(filter('is_any_of', ['home']))).toEqual(['Fix sink', 'Plan trip'])
    expect(list(filter('is_not_any_of', ['home']))).toEqual(['Email admin', 'Read book'])
    expect(list(filter('contains', ['WO']))).toEqual(['Email admin'])
    expect(list(filter('empty', []))).toEqual(['Read book'])
    expect(list(filter('not_empty', []))).toEqual(['Email admin', 'Fix sink', 'Plan trip'])
  })

  test('sorts numbers as numbers, with empty fields last', () => {
    const { list } = createFieldIndex()

    expect(list({ sorting: [{ id: 'field:estimate', desc: false }] })).toEqual([
      'Fix sink',
      'Email admin',
      'Plan trip',
      'Read book',
    ])
  })

  test('lists field names by use and their values for filters', () => {
    const { index } = createFieldIndex()

    expect(index.listFields()).toEqual([
      { key: 'type', count: 3 },
      { key: 'estimate', count: 2 },
    ])
    expect(index.listOptions({ field: 'field:type', search: '' })).toEqual(['Home', 'work'])
  })
})

describe('level filter', () => {
  test('keeps first-level tasks or subtasks', () => {
    const index = new TaskIndex()
    const content = ['- [ ] Trip', '\t- [ ] Hotel', '- Groceries', '  - [ ] Milk', '- [ ] Pack'].join('\n')
    index.replaceNoteTasks({ path: 'note.md', mtimeMs: 1, size: content.length }, parseNoteTasks('note.md', content))
    const list = (values: string[]) =>
      index
        .listTasks({ filters: [{ id: 'a', field: 'level', operator: 'is', values }], sorting: [], search: '' }, today, context)
        .map((task) => task.description)

    expect(list(['first'])).toEqual(['Trip', 'Pack'])
    expect(list(['subtask'])).toEqual(['Hotel', 'Milk'])
    expect(list([])).toEqual(['Trip', 'Hotel', 'Milk', 'Pack'])
  })
})
