import { describe, expect, test } from 'vitest'
import type { Task } from '@shared/taskTypes'
import { applyChangesLocally, formatTaskDate, getDisplayTitle, getDisplayValue, isOverdue } from './taskDisplayLogic'

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
})

const task: Task = {
  id: '1',
  filePath: 'a.md',
  note: 'a',
  folder: '',
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
}

describe('task state', () => {
  test('finds overdue open tasks only', () => {
    expect(isOverdue(task, '2026-10-31')).toBe(true)
    expect(isOverdue({ ...task, status: 'done' }, '2026-10-31')).toBe(false)
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
