import type { Settings, SettingsPatch } from '@shared/settingsTypes'
import type { SyncStatus } from '@shared/syncTypes'
import type {
  CreateTaskInput,
  Task,
  TaskListQuery,
  TaskOptionsInput,
  UpdateTaskInput,
} from '@shared/taskTypes'
import type { CreateViewInput, UpdateViewInput, View } from '@shared/viewTypes'

// Where an opened note goes: the current tab group, a new tab, or a split.
export const openTargets = ['tab', 'split'] as const
export type OpenTarget = (typeof openTargets)[number]

// Every request from the React UI to the plugin. The plugin validates each input with zod.
export type ApiContract = {
  'tasks:list': { input: TaskListQuery; output: Task[] }
  'tasks:create': { input: CreateTaskInput; output: Task }
  'tasks:update': { input: UpdateTaskInput; output: Task }
  'tasks:delete': { input: { id: string }; output: null }
  'tasks:options': { input: TaskOptionsInput; output: string[] }
  'tasks:fields': { input: null; output: Array<{ key: string; count: number }> }
  'tasks:open': { input: { id: string; target: OpenTarget }; output: null }
  // Opens a link to a note, resolved from the note that holds the task.
  'tasks:openLink': { input: { id: string; link: string; target: OpenTarget }; output: null }
  'views:list': { input: null; output: View[] }
  'views:create': { input: CreateViewInput; output: View }
  'views:update': { input: UpdateViewInput; output: View }
  'views:delete': { input: { id: string }; output: null }
  'settings:get': { input: null; output: Settings }
  'settings:update': { input: SettingsPatch; output: Settings }
  'vault:reindex': { input: null; output: null }
  'vault:status': { input: null; output: SyncStatus }
  'app:openSettings': { input: null; output: null }
}

export type ApiChannel = keyof ApiContract
export type ApiInput<Channel extends ApiChannel> = ApiContract[Channel]['input']
export type ApiOutput<Channel extends ApiChannel> = ApiContract[Channel]['output']

export type ApiHandlers = {
  [Channel in ApiChannel]: (input: ApiInput<Channel>) => ApiOutput<Channel> | Promise<ApiOutput<Channel>>
}
