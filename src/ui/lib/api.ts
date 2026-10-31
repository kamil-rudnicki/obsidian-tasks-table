import type { ApiChannel, ApiInput, ApiOutput } from '@shared/apiContract'
import type { AppEvent } from '@shared/syncTypes'
import { UserError } from '@shared/userError'

// What the plugin hands the React UI: requests, change events and a small
// per-vault key-value store for UI state such as the open view.
export type PluginApi = {
  invoke: <Channel extends ApiChannel>(
    channel: Channel,
    input: ApiInput<Channel>,
  ) => Promise<ApiOutput<Channel>>
  onEvent: (listener: (event: AppEvent) => void) => () => void
  loadUiState: (key: string) => unknown
  saveUiState: (key: string, value: unknown) => void
  isMac: boolean
}

let currentApi: PluginApi | null = null

export const setPluginApi = (api: PluginApi | null): void => {
  currentApi = api
}

export const getPluginApi = (): PluginApi => {
  if (!currentApi) {
    throw new Error('The tasks table plugin is not loaded.')
  }
  return currentApi
}

export const invoke = <Channel extends ApiChannel>(
  channel: Channel,
  input: ApiInput<Channel>,
): Promise<ApiOutput<Channel>> => getPluginApi().invoke(channel, input)

// Messages written for people are shown as they are; anything else is unexpected.
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof UserError) {
    return error.message
  }
  console.error('Tasks table:', error)
  return 'Something went wrong. Try again.'
}
