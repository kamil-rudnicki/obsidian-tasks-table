import { getToday, toLocalDateTime } from '@shared/dateLogic'
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

// Shows a change in every task list before the note is saved. Returns a
// function that undoes it.
const changeTaskLocally = async (id: string, change: (task: Task) => Task): Promise<() => void> => {
  await queryClient.cancelQueries({ queryKey: queryKeys.taskLists })
  const snapshots = queryClient.getQueriesData<Task[]>({ queryKey: queryKeys.taskLists })
  queryClient.setQueriesData<Task[]>({ queryKey: queryKeys.taskLists }, (tasks) =>
    tasks?.map((item) => (item.id === id ? change(item) : item)),
  )

  return () => {
    for (const [queryKey, data] of snapshots) {
      queryClient.setQueryData(queryKey, data)
    }
  }
}

export const updateTask = async (task: Task, changes: TaskChanges): Promise<void> => {
  const settings = queryClient.getQueryData<Settings>(queryKeys.settings)
  const options = { today: getToday(), setDoneDate: settings?.setDoneDate ?? true }
  const undo = await changeTaskLocally(task.id, (item) => applyChangesLocally(item, changes, options))

  try {
    const updated = await invoke('tasks:update', { id: task.id, changes })
    if (updated.filePath !== task.filePath) {
      notify(`Moved to ${updated.note}`)
    }
  } catch (error) {
    undo()
    notifyError(error)
  } finally {
    void refreshTasks()
  }
}

// Returns false when the comment could not be saved.
export const addComment = async (task: Task, text: string): Promise<boolean> => {
  const comment = { time: toLocalDateTime(new Date()), text: text.replace(/\s+/gu, ' ').trim() }
  const undo = await changeTaskLocally(task.id, (item) => ({ ...item, comments: [...item.comments, comment] }))

  try {
    await invoke('tasks:comment', { id: task.id, text: comment.text })
    return true
  } catch (error) {
    undo()
    notifyError(error)
    return false
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

export const cutTask = async (task: Task): Promise<void> => {
  try {
    await invoke('tasks:cut', { id: task.id })
    notify(`Cut “${getDisplayTitle(task.description)}” from ${task.note}. Paste it into any note.`)
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
