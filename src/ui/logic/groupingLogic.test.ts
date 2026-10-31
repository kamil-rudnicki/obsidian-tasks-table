import { describe, expect, test } from 'vitest'
import type { Task } from '@shared/taskTypes'
import { getCollapsedGroups, getExpandedGroups, getGroupLabel, groupTasks } from './groupingLogic'

const createTask = (id: string, changes: Partial<Task> = {}): Task => ({
  id,
  filePath: 'a.md',
  note: 'a',
  folder: '',
  line: 0,
  level: 1,
  description: id,
  status: 'todo',
  statusSymbol: ' ',
  priority: 'normal',
  dueDate: null,
  scheduledDate: null,
  startDate: null,
  createdDate: null,
  doneDate: null,
  cancelledDate: null,
  tags: [],
  fields: {},
  links: [],
  ...changes,
})

const summarize = (groups: ReturnType<typeof groupTasks>) =>
  groups.map((group) => `${group.key}: ${group.tasks.map((task) => task.id).join(',')}`)

describe('groupTasks', () => {
  test('groups by status in the order sorting uses and keeps the tasks in order', () => {
    const tasks = [
      createTask('a', { status: 'done' }),
      createTask('b'),
      createTask('c', { status: 'in_progress' }),
      createTask('d'),
    ]
    expect(summarize(groupTasks(tasks, { field: 'status', desc: false }))).toEqual([
      'in_progress: c',
      'todo: b,d',
      'done: a',
    ])
    expect(summarize(groupTasks(tasks, { field: 'status', desc: true }))).toEqual([
      'done: a',
      'todo: b,d',
      'in_progress: c',
    ])
  })

  test('puts tasks without a value last in both directions', () => {
    const tasks = [
      createTask('a'),
      createTask('b', { dueDate: '2026-11-02' }),
      createTask('c', { dueDate: '2026-10-30' }),
    ]
    expect(summarize(groupTasks(tasks, { field: 'dueDate', desc: false }))).toEqual([
      '2026-10-30: c',
      '2026-11-02: b',
      ': a',
    ])
    expect(summarize(groupTasks(tasks, { field: 'dueDate', desc: true }))).toEqual([
      '2026-11-02: b',
      '2026-10-30: c',
      ': a',
    ])
  })

  test('groups by priority, level, tags, notes and inline fields', () => {
    const tasks = [
      createTask('a', { priority: 'high', level: 2, tags: ['work', 'urgent'], fields: { size: '10' } }),
      createTask('b', { priority: 'low', tags: ['work'], filePath: 'x/b.md', note: 'b', fields: { size: '9' } }),
      createTask('c', { priority: 'high', level: 3, tags: ['work', 'urgent'] }),
    ]
    expect(summarize(groupTasks(tasks, { field: 'priority', desc: true }))).toEqual(['high: a,c', 'low: b'])
    expect(summarize(groupTasks(tasks, { field: 'level', desc: false }))).toEqual(['first: b', 'subtask: a,c'])
    expect(summarize(groupTasks(tasks, { field: 'tags', desc: false }))).toEqual(['work: b', 'work urgent: a,c'])
    expect(summarize(groupTasks(tasks, { field: 'note', desc: false }))).toEqual(['a.md: a,c', 'x/b.md: b'])
    expect(summarize(groupTasks(tasks, { field: 'field:size', desc: false }))).toEqual(['9: b', '10: a', ': c'])
  })
})

describe('collapsed groups', () => {
  test('opens every group except the collapsed ones', () => {
    expect(getExpandedGroups(['todo', 'done'], ['done'])).toEqual({ 'group:todo': true, 'group:done': false })
  })

  test('keeps the state of groups the filters hide', () => {
    const keys = ['todo', 'done']
    expect(getCollapsedGroups({ 'group:todo': false, 'group:done': true }, keys, ['cancelled'])).toEqual([
      'cancelled',
      'todo',
    ])
    expect(getCollapsedGroups(true, keys, ['cancelled', 'done'])).toEqual(['cancelled'])
    expect(getCollapsedGroups(false, keys, [])).toEqual(['todo', 'done'])
  })
})

describe('getGroupLabel', () => {
  const today = '2026-10-31'

  test('names groups as the table shows values', () => {
    expect(getGroupLabel('status', 'in_progress', createTask('a', { status: 'in_progress' }), today)).toBe('In progress')
    expect(getGroupLabel('dueDate', '2026-11-01', createTask('a'), today)).toBe('Tomorrow')
    expect(getGroupLabel('dueDate', '', createTask('a'), today)).toBe('No due date')
    expect(getGroupLabel('tags', '', createTask('a'), today)).toBe('No tags')
    expect(getGroupLabel('folder', '', createTask('a'), today)).toBe('Vault root')
    expect(getGroupLabel('level', 'subtask', createTask('a', { level: 2 }), today)).toBe('Subtask')
    expect(getGroupLabel('field:owner', '[[People/Ann|Ann]]', createTask('a'), today)).toBe('Ann')
  })
})
