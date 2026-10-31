import { createStore } from '@tanstack/react-store'

// Whether the "New task" field is open. A store, not component state, so the
// "Add task" command and Mod+N can open it whichever view is mounted.
export const newTaskStore = createStore({ open: false })

export const setNewTaskOpen = (open: boolean): void => {
  newTaskStore.setState(() => ({ open }))
}
