import { createStore } from '@tanstack/react-store'
import type { Task } from '@shared/taskTypes'
import { deleteTask } from '@/logic/taskActions'

// One confirmation dialog serves every row.
export const deleteTaskStore = createStore<{ task: Task | null }>({ task: null })

export const requestTaskDelete = (task: Task): void => {
  deleteTaskStore.setState(() => ({ task }))
}

export const cancelTaskDelete = (): void => {
  deleteTaskStore.setState(() => ({ task: null }))
}

export const confirmTaskDelete = async (): Promise<void> => {
  const { task } = deleteTaskStore.state
  cancelTaskDelete()
  if (task) {
    await deleteTask(task)
  }
}
