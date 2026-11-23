export type SyncState = 'starting' | 'indexing' | 'idle' | 'error'

export type SyncStatus = {
  state: SyncState
  taskCount: number
  noteCount: number
  lastIndexedAt: string | null
  error: string | null
}

export type AppEvent =
  | { type: 'tasks-changed' }
  // The local date changed, such as at midnight or after the computer slept.
  | { type: 'day-changed'; today: string }
  | { type: 'views-changed' }
  | { type: 'settings-changed' }
  | { type: 'sync-status'; status: SyncStatus }
  | { type: 'focus-new-task' }
  | { type: 'focus-search' }
