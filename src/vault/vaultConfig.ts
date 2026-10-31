import { moment, normalizePath, type App } from 'obsidian'
import {
  parseDailyNotesConfig,
  type DailyNotesConfig,
  type DateFormatter,
  type DateParser,
} from './dailyNotes'

// Obsidian's moment.js, so dates follow the same tokens and locale as Obsidian.
// Typed here with the calls this file makes: `moment`'s own types come from a
// package nested in `obsidian`, which not every type-aware check resolves.
type MomentDate = { isValid: () => boolean; format: (format: string) => string }
const obsidianMoment = moment as (input: Date | string, format?: string, strict?: boolean) => MomentDate

export const formatDate: DateFormatter = (date, format) => obsidianMoment(date).format(format)

export const parseDate: DateParser = (text, format) => {
  const date = obsidianMoment(text, format, true)
  return date.isValid() ? date.format('YYYY-MM-DD') : null
}

// Reads a JSON file from the vault's configuration folder; null when it is missing or invalid.
export const readConfigJson = async (app: App, fileName: string): Promise<unknown> => {
  try {
    return JSON.parse(await app.vault.adapter.read(normalizePath(`${app.vault.configDir}/${fileName}`))) as unknown
  } catch {
    return null
  }
}

export const readDailyNotesConfig = async (app: App): Promise<DailyNotesConfig> =>
  parseDailyNotesConfig(await readConfigJson(app, 'daily-notes.json'))
