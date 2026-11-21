import { createStore } from '@tanstack/react-store'
import type { Settings } from '@shared/settingsTypes'
import type { Task } from '@shared/taskTypes'
import { invoke } from '@/lib/api'
import { notify, notifyError } from '@/lib/notify'
import { queryKeys } from '@/lib/queries'
import { queryClient } from '@/lib/queryClient'
import { isOpenTask } from '@/logic/taskDisplayLogic'

// True when a change completed or cancelled an open task that is not in
// today's daily note.
export const isClosedAwayFromToday = (
  before: Pick<Task, 'status'>,
  after: Pick<Task, 'status' | 'dailyNote'>,
  today: string,
): boolean => isOpenTask(before) && !isOpenTask(after) && after.dailyNote !== today

// One dialog serves every row. The task stays while the dialog closes, so its
// text does not go away during the closing animation.
export const moveToTodayStore = createStore<{ task: Task | null; open: boolean; remember: boolean }>({
  task: null,
  open: false,
  remember: false,
})

const refreshTasks = (): Promise<void> => queryClient.invalidateQueries({ queryKey: queryKeys.tasks })

const moveTaskToToday = async (task: Task): Promise<void> => {
  try {
    const moved = await invoke('tasks:moveToToday', { id: task.id })
    if (moved.filePath !== task.filePath) {
      notify(`Moved to ${moved.note}`)
    }
  } catch (error) {
    notifyError(error)
  } finally {
    void refreshTasks()
  }
}

// After you complete or cancel a task in another note: asks to move it to
// today's daily note, moves it, or does nothing, as the setting says.
export const offerMoveToToday = async (task: Task): Promise<void> => {
  const settings = queryClient.getQueryData<Settings>(queryKeys.settings)
  const mode = settings?.moveClosedToToday ?? 'ask'

  if (mode === 'always') {
    await moveTaskToToday(task)
  } else if (mode === 'ask') {
    moveToTodayStore.setState(() => ({ task, open: true, remember: false }))
  }
}

export const setRememberMoveToToday = (remember: boolean): void => {
  moveToTodayStore.setState((state) => ({ ...state, remember }))
}

export const closeMoveToToday = (): void => {
  moveToTodayStore.setState((state) => ({ ...state, open: false }))
}

// "Don't ask again" keeps the answer in the settings, where you can change it.
const rememberAnswer = async (move: boolean): Promise<void> => {
  try {
    const settings = await invoke('settings:update', { moveClosedToToday: move ? 'always' : 'never' })
    queryClient.setQueryData(queryKeys.settings, settings)
    notify(
      move
        ? 'Done and cancelled tasks now move to today’s daily note. Change this in Settings → Tasks Table.'
        : 'Done and cancelled tasks now stay in their notes. Change this in Settings → Tasks Table.',
    )
  } catch (error) {
    notifyError(error)
  }
}

export const answerMoveToToday = async (move: boolean): Promise<void> => {
  const { task, open, remember } = moveToTodayStore.state
  if (!open) {
    return
  }
  closeMoveToToday()
  if (remember) {
    await rememberAnswer(move)
  }
  if (move && task) {
    await moveTaskToToday(task)
  }
}
