import { z } from 'zod'

export const taskFormats = ['emoji', 'dataview'] as const
export const newTaskTargets = ['dailyNote', 'note'] as const

// A full path on macOS, Linux or Windows, such as `/Users/you/Projects`.
export const isFullPath = (path: string): boolean => /^(?:\/|[A-Za-z]:[\\/]|\\\\)/u.test(path)

export const fullPathMessage = 'Enter a full path, such as /Users/you/Projects/notes.'

// Each key is one row in the `settings` table. The value column holds JSON.
export const settingSchemas = {
  newTaskTarget: z.enum(newTaskTargets),
  newTaskNotePath: z.string().trim().min(1).max(1024),
  newTaskHeading: z.string().trim().max(200),
  taskFormat: z.enum(taskFormats),
  setDoneDate: z.boolean(),
  setCreatedDate: z.boolean(),
  moveToStartDateNote: z.boolean(),
  // The folder a chat from "Run ChatGPT Desktop" or "Run Claude Desktop" works in.
  // Empty means the vault folder.
  chatFolder: z
    .string()
    .trim()
    .max(1024)
    .refine((path) => path === '' || isFullPath(path), fullPathMessage),
} as const

export const settingsSchema = z.object(settingSchemas)
export type Settings = z.infer<typeof settingsSchema>
export type SettingName = keyof Settings

export const settingNames = Object.keys(settingSchemas) as SettingName[]

export const defaultSettings: Settings = {
  newTaskTarget: 'dailyNote',
  newTaskNotePath: 'Inbox.md',
  newTaskHeading: '',
  taskFormat: 'emoji',
  setDoneDate: true,
  setCreatedDate: false,
  moveToStartDateNote: true,
  chatFolder: '',
}

export const settingsPatchSchema = settingsSchema.partial()
export type SettingsPatch = z.infer<typeof settingsPatchSchema>
