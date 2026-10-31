import { invoke } from '@/lib/api'
import { notifyError } from '@/lib/notify'

export const reindexVault = async (): Promise<void> => {
  try {
    await invoke('vault:reindex', null)
  } catch (error) {
    notifyError(error)
  }
}

export const openSettings = async (): Promise<void> => {
  try {
    await invoke('app:openSettings', null)
  } catch (error) {
    notifyError(error)
  }
}
