import type { SyncStatus } from '@shared/syncTypes'

const numberFormat = new Intl.NumberFormat('en-US')
const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })

const pluralize = (count: number, word: string): string =>
  `${numberFormat.format(count)} ${word}${count === 1 ? '' : 's'}`

export const describeSyncStatus = (status: SyncStatus): string => {
  const counts = `${pluralize(status.taskCount, 'task')} in ${pluralize(status.noteCount, 'note')}`

  switch (status.state) {
    case 'starting':
      return 'Starting…'
    case 'indexing':
      return `Indexing the vault… ${counts}`
    case 'error':
      return status.error ?? 'The vault could not be indexed.'
    case 'idle':
      return status.lastIndexedAt
        ? `${counts}. Indexed at ${timeFormat.format(new Date(status.lastIndexedAt))}.`
        : counts
  }
}

export const formatResultCount = (count: number): string => pluralize(count, 'result')
