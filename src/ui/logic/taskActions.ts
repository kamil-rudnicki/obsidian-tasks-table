import { getToday } from '@shared/dateLogic'
import type { OpenTarget } from '@shared/apiContract'
import type { Settings } from '@shared/settingsTypes'
import type { CreateTaskInput, Task, TaskChanges, TaskLink } from '@shared/taskTypes'
import { invoke } from '@/lib/api'
import { notify, notifyError } from '@/lib/notify'
import { queryKeys } from '@/lib/queries'
import { queryClient } from '@/lib/queryClient'
import { applyChangesLocally, getDisplayTitle } from '@/logic/taskDisplayLogic'

const refreshTasks = (): Promise<void> =>
  queryClient.invalidateQueries({ queryKey: queryKeys.tasks })

export const updateTask = async (task: Task, changes: TaskChanges): Promise<void> => {
  const settings = queryClient.getQueryData<Settings>(queryKeys.settings)
  const options = { today: getToday(), setDoneDate: settings?.setDoneDate ?? true }

  await queryClient.cancelQueries({ queryKey: queryKeys.taskLists })
  const snapshots = queryClient.getQueriesData<Task[]>({ queryKey: queryKeys.taskLists })
  queryClient.setQueriesData<Task[]>({ queryKey: queryKeys.taskLists }, (tasks) =>
    tasks?.map((item) => (item.id === task.id ? applyChangesLocally(item, changes, options) : item)),
  )

  try {
    const updated = await invoke('tasks:update', { id: task.id, changes })
    if (updated.filePath !== task.filePath) {
      notify(`Moved to ${updated.note}`)
    }
  } catch (error) {
    for (const [queryKey, data] of snapshots) {
      queryClient.setQueryData(queryKey, data)
    }
    notifyError(error)
  } finally {
    void refreshTasks()
  }
}

export const createTask = async (input: CreateTaskInput): Promise<Task | null> => {
  try {
    const task = await invoke('tasks:create', input)
    notify(`Added to ${task.note}`)
    void refreshTasks()
    return task
  } catch (error) {
    notifyError(error)
    return null
  }
}

export const deleteTask = async (task: Task): Promise<void> => {
  try {
    await invoke('tasks:delete', { id: task.id })
    notify(`Removed “${getDisplayTitle(task.description)}” from ${task.note}`)
  } catch (error) {
    notifyError(error)
  } finally {
    void refreshTasks()
  }
}

// A modifier key (Cmd on macOS, Ctrl elsewhere) opens the note in a split.
export const openTask = async (task: Task, target: OpenTarget = 'tab'): Promise<void> => {
  try {
    await invoke('tasks:open', { id: task.id, target })
  } catch (error) {
    notifyError(error)
  }
}

// Opens a link to a note the way the note itself would: relative to the task's note.
export const openTaskLink = async (task: Task, link: TaskLink, target: OpenTarget): Promise<void> => {
  try {
    await invoke('tasks:openLink', { id: task.id, link: link.target, target })
  } catch (error) {
    notifyError(error)
  }
}
