import {
  defaultSettings,
  settingNames,
  settingSchemas,
  type SettingName,
  type Settings,
  type SettingsPatch,
} from '@shared/settingsTypes'
import type { AppDatabase } from './appDatabase'

const isSettingName = (name: string): name is SettingName =>
  (settingNames as string[]).includes(name)

const parseValue = (name: SettingName, value: string): unknown => {
  try {
    const result = settingSchemas[name].safeParse(JSON.parse(value))
    return result.success ? result.data : defaultSettings[name]
  } catch {
    return defaultSettings[name]
  }
}

export const createSettingsRepository = (database: AppDatabase) => {
  const { sql } = database

  const getSettings = (): Settings => {
    const settings: Record<string, unknown> = { ...defaultSettings }

    for (const row of sql.all<{ name: string; value: string }>('select name, value from settings')) {
      if (isSettingName(row.name)) {
        settings[row.name] = parseValue(row.name, row.value)
      }
    }

    return settings as Settings
  }

  const hasSetting = (name: SettingName): boolean =>
    sql.get('select 1 from settings where name = ?', [name]) !== undefined

  // The patch must already be validated with `settingsPatchSchema`.
  const updateSettings = (patch: SettingsPatch): Settings => {
    sql.transaction(() => {
      for (const [name, value] of Object.entries(patch)) {
        if (isSettingName(name) && value !== undefined) {
          sql.run(
            `insert into settings (name, value) values (?, ?)
             on conflict (name) do update set value = excluded.value`,
            [name, JSON.stringify(value)],
          )
        }
      }
    })
    database.markChanged()

    return getSettings()
  }

  return { getSettings, hasSetting, updateSettings }
}

export type SettingsRepository = ReturnType<typeof createSettingsRepository>
