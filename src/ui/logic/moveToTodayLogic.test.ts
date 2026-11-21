import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ApiChannel } from '@shared/apiContract'
import { defaultSettings, type ClosedTaskMove } from '@shared/settingsTypes'
import type { Task } from '@shared/taskTypes'
import { setPluginApi } from '@/lib/api'
import { queryKeys } from '@/lib/queries'
import { queryClient } from '@/lib/queryClient'
import {
  answerMoveToToday,
  closeMoveToToday,
  isClosedAwayFromToday,
  moveToTodayStore,
  offerMoveToToday,
  setRememberMoveToToday,
} from './moveToTodayLogic'

// Notices are Obsidian's; the tests check what the logic asks the plugin for.
vi.mock('@/lib/notify', () => ({ notify: vi.fn(), notifyError: vi.fn() }))

const today = '2026-11-21'

const task: Task = {
  id: 'task-1',
  filePath: 'Projects/Website.md',
  note: 'Website',
  folder: 'Projects',
  dailyNote: null,
  line: 2,
  level: 1,
  description: 'Review pricing page',
  status: 'done',
  statusSymbol: 'x',
  priority: 'normal',
  dueDate: null,
  scheduledDate: null,
  startDate: null,
  createdDate: null,
  doneDate: today,
  cancelledDate: null,
  tags: [],
  fields: {},
  links: [],
  comments: [],
}

const calls: Array<{ channel: ApiChannel; input: unknown }> = []

const useSetting = (moveClosedToToday: ClosedTaskMove): void => {
  queryClient.setQueryData(queryKeys.settings, { ...defaultSettings, moveClosedToToday })
}

beforeEach(() => {
  calls.length = 0
  setPluginApi({
    invoke: (channel, input) => {
      calls.push({ channel, input })
      if (channel === 'tasks:moveToToday') {
        return Promise.resolve({ ...task, filePath: `Daily/${today}.md`, note: today, dailyNote: today } as never)
      }
      if (channel === 'settings:update') {
        return Promise.resolve({ ...defaultSettings, ...(input as object) } as never)
      }
      return Promise.reject(new Error(`Unexpected call: ${channel}`))
    },
    onEvent: () => () => undefined,
    loadUiState: () => undefined,
    saveUiState: () => undefined,
    isMac: true,
  })
  moveToTodayStore.setState(() => ({ task: null, open: false, remember: false }))
})

afterEach(() => {
  setPluginApi(null)
  queryClient.clear()
})

describe('isClosedAwayFromToday', () => {
  test('is true when an open task is completed or cancelled in another note', () => {
    expect(isClosedAwayFromToday({ status: 'todo' }, { status: 'done', dailyNote: null }, today)).toBe(true)
    expect(isClosedAwayFromToday({ status: 'later' }, { status: 'cancelled', dailyNote: '2026-11-20' }, today)).toBe(
      true,
    )
  })

  test('is false in today’s daily note, for open tasks and for tasks that were closed already', () => {
    expect(isClosedAwayFromToday({ status: 'todo' }, { status: 'done', dailyNote: today }, today)).toBe(false)
    expect(isClosedAwayFromToday({ status: 'done' }, { status: 'todo', dailyNote: null }, today)).toBe(false)
    expect(isClosedAwayFromToday({ status: 'done' }, { status: 'cancelled', dailyNote: null }, today)).toBe(false)
    expect(isClosedAwayFromToday({ status: 'todo' }, { status: 'in_progress', dailyNote: null }, today)).toBe(false)
  })
})

describe('offerMoveToToday', () => {
  test('asks first by default', async () => {
    await offerMoveToToday(task)
    expect(moveToTodayStore.state).toEqual({ task, open: true, remember: false })
    expect(calls).toEqual([])
  })

  test('moves the task without asking when the setting says always', async () => {
    useSetting('always')
    await offerMoveToToday(task)
    expect(moveToTodayStore.state.open).toBe(false)
    expect(calls).toEqual([{ channel: 'tasks:moveToToday', input: { id: task.id } }])
  })

  test('does nothing when the setting says never', async () => {
    useSetting('never')
    await offerMoveToToday(task)
    expect(moveToTodayStore.state.open).toBe(false)
    expect(calls).toEqual([])
  })
})

describe('answerMoveToToday', () => {
  test('moves the task and keeps the task while the dialog closes', async () => {
    await offerMoveToToday(task)
    await answerMoveToToday(true)
    expect(moveToTodayStore.state).toEqual({ task, open: false, remember: false })
    expect(calls).toEqual([{ channel: 'tasks:moveToToday', input: { id: task.id } }])
  })

  test('keeps the task in its note', async () => {
    await offerMoveToToday(task)
    await answerMoveToToday(false)
    expect(moveToTodayStore.state.open).toBe(false)
    expect(calls).toEqual([])
  })

  test('saves the answer with Don’t ask again', async () => {
    await offerMoveToToday(task)
    setRememberMoveToToday(true)
    await answerMoveToToday(true)
    expect(calls).toEqual([
      { channel: 'settings:update', input: { moveClosedToToday: 'always' } },
      { channel: 'tasks:moveToToday', input: { id: task.id } },
    ])
    expect(queryClient.getQueryData(queryKeys.settings)).toMatchObject({ moveClosedToToday: 'always' })

    calls.length = 0
    await offerMoveToToday(task)
    expect(moveToTodayStore.state.open).toBe(false)
    expect(calls).toEqual([{ channel: 'tasks:moveToToday', input: { id: task.id } }])
  })

  test('saves Keep in note with Don’t ask again', async () => {
    await offerMoveToToday(task)
    setRememberMoveToToday(true)
    await answerMoveToToday(false)
    expect(calls).toEqual([{ channel: 'settings:update', input: { moveClosedToToday: 'never' } }])
  })

  test('answers once, and not after the dialog was dismissed', async () => {
    await offerMoveToToday(task)
    await Promise.all([answerMoveToToday(true), answerMoveToToday(true)])
    expect(calls).toHaveLength(1)

    calls.length = 0
    await offerMoveToToday(task)
    setRememberMoveToToday(true)
    closeMoveToToday()
    await answerMoveToToday(true)
    expect(calls).toEqual([])
  })
})
