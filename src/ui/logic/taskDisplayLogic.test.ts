import { describe, expect, test } from 'vitest'
import type { Task } from '@shared/taskTypes'
import {
  applyChangesLocally,
  formatExactDate,
  formatTaskDate,
  getDisplayTitle,
  getDisplayValue,
  getTextParts,
  isOverdue,
} from './taskDisplayLogic'

describe('getDisplayTitle', () => {
  test.each([
    ['#type/task Email admin [id:: 134]', 'Email admin'],
    ['Read [[folder/Book#Chapter|the book]] and [[Other note]]', 'Read the book and Other note'],
    ['See [docs](https://example.com) now', 'See docs now'],
    ['#only-tags', '#only-tags'],
    ['Keep C# and 100%', 'Keep C# and 100%'],
    ['Ford polisa 🛫  [start:: 2025-10-10]', 'Ford polisa'],
    ['Read [source:: [[Meeting notes|Notes]]] [person name:: Ann]', 'Read'],
  ])('shows %s as %s', (description, title) => {
    expect(getDisplayTitle(description)).toBe(title)
  })
})

describe('applyChangesLocally', () => {
  test('changes only the given fields, and removes one with an empty value', () => {
    const before = { fields: { type: 'work', area: 'home' } } as unknown as Task
    const options = { today: '2026-10-31', setDoneDate: true }

    expect(applyChangesLocally(before, { fields: { type: 'play', size: 'S' } }, options).fields).toEqual({
      type: 'play',
      area: 'home',
      size: 'S',
    })
    expect(applyChangesLocally(before, { fields: { area: '' } }, options).fields).toEqual({ type: 'work' })
  })
})

describe('getTextParts', () => {
  test('shows a link back to an agent chat as the app', () => {
    expect(getTextParts('Agent is running in codex://threads/01a1a0f1-5cbe-7ba1-90ad-c88f7ee78632')).toEqual([
      { text: 'Agent is running in ' },
      { text: 'ChatGPT', url: 'codex://threads/01a1a0f1-5cbe-7ba1-90ad-c88f7ee78632' },
    ])
    expect(getTextParts('Agent is running in claude://code/continue?session=local_ab12')).toEqual([
      { text: 'Agent is running in ' },
      { text: 'Claude', url: 'claude://code/continue?session=local_ab12' },
    ])
  })

  test('keeps web addresses and Markdown links, without the punctuation after them', () => {
    expect(getTextParts('See https://example.com/a?b=1. And [docs](https://example.com/docs), [[Notes|notes]]')).toEqual([
      { text: 'See ' },
      { text: 'https://example.com/a?b=1', url: 'https://example.com/a?b=1' },
      { text: '. And ' },
      { text: 'docs', url: 'https://example.com/docs' },
      { text: ', notes' },
    ])
  })

  test('keeps links with other schemes as text', () => {
    expect(getTextParts('Run [this](javascript:alert) or file:///etc/hosts')).toEqual([
      { text: 'Run this or file:///etc/hosts' },
    ])
  })

  test('reads an inline field value that is only a link', () => {
    expect(getTextParts('codex://threads/01a1fd5b-93c2-7670-982b-c12a6b16fc8d')).toEqual([
      { text: 'ChatGPT', url: 'codex://threads/01a1fd5b-93c2-7670-982b-c12a6b16fc8d' },
    ])
    expect(getTextParts('[[People/Ann Smith|Ann]]')).toEqual([{ text: 'Ann' }])
  })
})

describe('formatTaskDate', () => {
  const today = '2026-10-31'

  test.each([
    ['2026-10-31', 'Today'],
    ['2026-11-01', 'Tomorrow'],
    ['2026-10-30', 'Yesterday'],
    ['2026-11-03', 'Tuesday'],
    ['2026-11-07', 'Nov 7'],
    ['2025-01-02', 'Jan 2, 2025'],
  ])('formats %s', (date, label) => {
    expect(formatTaskDate(date, today)).toBe(label)
  })

  test('formats a fixed date without words relative to today', () => {
    expect(formatExactDate('2026-10-31', today)).toBe('Oct 31')
    expect(formatExactDate('2026-11-03', today)).toBe('Nov 3')
    expect(formatExactDate('2025-01-02', today)).toBe('Jan 2, 2025')
  })
})

const task: Task = {
  id: '1',
  filePath: 'a.md',
  note: 'a',
  folder: '',
  dailyNote: null,
  line: 0,
  level: 1,
  description: 'A',
  status: 'todo',
  statusSymbol: ' ',
  priority: 'normal',
  dueDate: '2026-10-30',
  scheduledDate: null,
  startDate: null,
  createdDate: null,
  doneDate: null,
  cancelledDate: null,
  tags: [],
  fields: {},
  links: [],
  comments: [],
}

describe('task state', () => {
  test('finds overdue open tasks only', () => {
    expect(isOverdue(task, '2026-10-31')).toBe(true)
    expect(isOverdue({ ...task, status: 'done' }, '2026-10-31')).toBe(false)
    // A task put off for later is still open.
    expect(isOverdue({ ...task, status: 'later' }, '2026-10-31')).toBe(true)
    expect(isOverdue({ ...task, dueDate: null }, '2026-10-31')).toBe(false)
  })

  test('applies status changes with completion dates like main does', () => {
    const options = { today: '2026-10-31', setDoneDate: true }
    expect(applyChangesLocally(task, { status: 'done' }, options)).toMatchObject({ status: 'done', doneDate: '2026-10-31' })
    expect(applyChangesLocally({ ...task, status: 'done', doneDate: '2026-01-01' }, { status: 'todo' }, options)).toMatchObject({
      status: 'todo',
      doneDate: null,
    })
    expect(applyChangesLocally(task, { status: 'done' }, { ...options, setDoneDate: false }).doneDate).toBeNull()
  })
})

describe('getDisplayValue', () => {
  test('shows link text', () => {
    expect(getDisplayValue('[[People/Ann Smith|Ann]] and [[Projects/Website]]')).toBe('Ann and Website')
    expect(getDisplayValue('[docs](https://example.com)')).toBe('docs')
  })
})
