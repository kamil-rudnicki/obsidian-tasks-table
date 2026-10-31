import { z } from 'zod'

export const taskFormats = ['emoji', 'dataview'] as const
export const newTaskTargets = ['dailyNote', 'note'] as const

// Each key is one row in the `settings` table. The value column holds JSON.
export const settingSchemas = {
  newTaskTarget: z.enum(newTaskTargets),
  newTaskNotePath: z.string().trim().min(1).max(1024),
  newTaskHeading: z.string().trim().max(200),
  taskFormat: z.enum(taskFormats),
  setDoneDate: z.boolean(),
  setCreatedDate: z.boolean(),
  moveToStartDateNote: z.boolean(),
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
}

export const settingsPatchSchema = settingsSchema.partial()
export type SettingsPatch = z.infer<typeof settingsPatchSchema>
