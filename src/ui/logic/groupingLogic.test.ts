import { describe, expect, test } from 'vitest'
import type { Task } from '@shared/taskTypes'
import {
  getCollapsedGroups,
  getExpandedGroups,
  getGroupedOrder,
  getGroupLabel,
  getGroupRowIds,
  groupTasks,
  keepCollapsedGroups,
  nestGroups,
} from './groupingLogic'

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
  comments: [],
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

describe('nested groups', () => {
  const tasks = [
    createTask('a', { status: 'done', priority: 'high' }),
    createTask('b', { priority: 'low' }),
    createTask('c', { priority: 'high' }),
    createTask('d', { status: 'done', priority: 'low' }),
  ]
  const groups = nestGroups(tasks, [
    { field: 'status', desc: false },
    { field: 'priority', desc: true },
  ])

  test('groups each group again by the second property', () => {
    expect(getGroupRowIds(groups)).toEqual([
      'group:todo',
      'group:todo>subgroup:high',
      'group:todo>subgroup:low',
      'group:done',
      'group:done>subgroup:high',
      'group:done>subgroup:low',
    ])
    expect(getGroupedOrder(groups).map((task) => task.id)).toEqual(['c', 'b', 'a', 'd'])
  })

  test('keeps one level when there is no second property', () => {
    const single = nestGroups(tasks, [{ field: 'status', desc: false }])
    expect(getGroupRowIds(single)).toEqual(['group:todo', 'group:done'])
    expect(getGroupedOrder(single).map((task) => task.id)).toEqual(['b', 'c', 'a', 'd'])
  })
})

describe('collapsed groups', () => {
  const ids = ['group:todo', 'group:todo>subgroup:high', 'group:done']

  test('opens every group except the collapsed ones', () => {
    expect(getExpandedGroups(ids, ['group:done'])).toEqual({
      'group:todo': true,
      'group:todo>subgroup:high': true,
      'group:done': false,
    })
  })

  test('keeps the state of groups the filters hide and drops values saved before nesting', () => {
    expect(
      getCollapsedGroups(
        { 'group:todo': true, 'group:todo>subgroup:high': false, 'group:done': true },
        ids,
        ['group:cancelled', 'in_progress'],
      ),
    ).toEqual(['group:cancelled', 'group:todo>subgroup:high'])
    expect(getCollapsedGroups(true, ids, ['group:cancelled', 'group:done'])).toEqual(['group:cancelled'])
    expect(getCollapsedGroups(false, ids, [])).toEqual(ids)
  })

  test('keeps the collapsed groups of the levels that keep their property', () => {
    const collapsed = ['group:todo', 'group:todo>subgroup:high']
    const status = { field: 'status', desc: false } as const
    const priority = { field: 'priority', desc: true } as const
    expect(keepCollapsedGroups(collapsed, [status, priority], [{ ...status, desc: true }, priority])).toEqual(collapsed)
    expect(keepCollapsedGroups(collapsed, [status, priority], [status, { field: 'tags', desc: false }])).toEqual([
      'group:todo',
    ])
    expect(keepCollapsedGroups(collapsed, [status], [priority])).toEqual([])
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
