import { createStore } from '@tanstack/react-store'
import type { View } from '@shared/viewTypes'

export type ViewDialogMode = 'create' | 'duplicate' | 'rename'

// One name dialog serves "New view", "Duplicate view" and "Rename view".
export const viewDialogStore = createStore<{ mode: ViewDialogMode | null; view: View | null }>({
  mode: null,
  view: null,
})

export const openViewDialog = (mode: ViewDialogMode, view: View): void => {
  viewDialogStore.setState(() => ({ mode, view }))
}

export const closeViewDialog = (): void => {
  viewDialogStore.setState((state) => ({ ...state, mode: null }))
}
