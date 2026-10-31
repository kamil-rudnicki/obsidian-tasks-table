import type { TaskFormat } from './taskLineSyntax'

export type DailyNotesConfig = {
  folder: string
  format: string
  template: string | null
}

// Formats a date with moment.js tokens, as Obsidian names daily notes.
export type DateFormatter = (date: Date, format: string) => string

// Reads text that must match a moment.js format exactly; returns an ISO date or null.
export type DateParser = (text: string, format: string) => string | null

const defaultDailyNoteFormat = 'YYYY-MM-DD'

const readString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : ''

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null

// Reads `.obsidian/daily-notes.json` of the core Daily notes plugin.
export const parseDailyNotesConfig = (json: unknown): DailyNotesConfig => {
  const config = asRecord(json)
  const template = readString(config?.template)

  return {
    folder: readString(config?.folder).replace(/^\/+|\/+$/gu, ''),
    format: readString(config?.format) || defaultDailyNoteFormat,
    template: template === '' ? null : template,
  }
}

export type TasksPluginDefaults = {
  taskFormat: TaskFormat | null
  setCreatedDate: boolean | null
}

// Reads the Obsidian Tasks plugin's settings, so both plugins write tasks alike.
export const parseTasksPluginDefaults = (json: unknown): TasksPluginDefaults => {
  const config = asRecord(json)
  const taskFormat =
    config?.taskFormat === 'dataview'
      ? 'dataview'
      : config?.taskFormat === 'tasksPluginEmoji'
        ? 'emoji'
        : null

  return {
    taskFormat,
    setCreatedDate: typeof config?.setCreatedDate === 'boolean' ? config.setCreatedDate : null,
  }
}

export const getDailyNotePath = (
  config: DailyNotesConfig,
  date: Date,
  formatDate: DateFormatter,
): string => {
  const name = `${formatDate(date, config.format)}.md`
  return config.folder === '' ? name : `${config.folder}/${name}`
}

// The date of a daily note, read from its path the way the Daily notes plugin
// names notes. Notes in subfolders of the daily notes folder count too, as
// archives by year often are, unless the format itself names folders.
export const getDailyNoteDate = (
  config: DailyNotesConfig,
  filePath: string,
  parseDate: DateParser,
): string | null => {
  const prefix = config.folder === '' ? '' : `${config.folder}/`

  if (!filePath.startsWith(prefix) || !/\.md$/iu.test(filePath)) {
    return null
  }

  const relativePath = filePath.slice(prefix.length).replace(/\.md$/iu, '')
  const name = config.format.includes('/')
    ? relativePath
    : relativePath.slice(relativePath.lastIndexOf('/') + 1)

  return parseDate(name, config.format)
}

export const getTemplatePath = (template: string): string =>
  /\.md$/iu.test(template) ? template : `${template}.md`

// Fills the variables of Obsidian's core Templates plugin.
export const renderTemplate = (
  template: string,
  title: string,
  date: Date,
  formatDate: DateFormatter,
): string =>
  template.replace(
    /\{\{\s*(date|time|title)(?::([^}]*))?\s*\}\}/gu,
    (_match, variable: string, format: string | undefined) => {
      if (variable === 'title') {
        return title
      }
      return formatDate(date, format?.trim() || (variable === 'date' ? 'YYYY-MM-DD' : 'HH:mm'))
    },
  )
