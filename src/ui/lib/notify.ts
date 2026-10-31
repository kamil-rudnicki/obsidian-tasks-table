import { Notice } from 'obsidian'
import { getErrorMessage } from '@/lib/api'

export const notify = (message: string): void => {
  new Notice(message)
}

export const notifyError = (error: unknown): void => {
  new Notice(getErrorMessage(error))
}
