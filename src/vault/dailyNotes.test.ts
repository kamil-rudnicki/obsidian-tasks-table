import { describe, expect, test } from 'vitest'
import {
  getDailyNoteDate,
  getDailyNotePath,
  parseDailyNotesConfig,
  parseTasksPluginDefaults,
  renderTemplate,
  type DateFormatter,
  type DateParser,
} from './dailyNotes'

const date = new Date(2026, 9, 1, 9, 5, 7)

const pad = (value: number): string => String(value).padStart(2, '0')

// Enough of moment.js for these tests; the plugin passes the real moment.
const formatDate: DateFormatter = (value, format) =>
  format
    .replace('YYYY', String(value.getFullYear()))
    .replace('MM', pad(value.getMonth() + 1))
    .replace('DD', pad(value.getDate()))
    .replace('HH', pad(value.getHours()))
    .replace('mm', pad(value.getMinutes()))

describe('daily notes', () => {
  test('builds the note path and fills the template', () => {
    expect(
      getDailyNotePath({ folder: 'periodic/daily', format: 'YYYY-MM-DD', template: null }, date, formatDate),
    ).toBe('periodic/daily/2026-10-01.md')
    expect(getDailyNotePath({ folder: '', format: 'YYYY-MM-DD', template: null }, date, formatDate)).toBe(
      '2026-10-01.md',
    )
    expect(renderTemplate('# {{title}} {{date:YYYY}} {{ time }}', 'Day', date, formatDate)).toBe(
      '# Day 2026 09:05',
    )
  })

  test('reads the daily notes configuration', () => {
    expect(parseDailyNotesConfig(null)).toEqual({ folder: '', format: 'YYYY-MM-DD', template: null })
    expect(parseDailyNotesConfig({ folder: '/daily/', template: 'meta/daily' })).toEqual({
      folder: 'daily',
      format: 'YYYY-MM-DD',
      template: 'meta/daily',
    })
  })
})

// Enough of moment.js's strict parsing for these tests: YYYY, MM, DD and
// literal text. A repeated token takes its last value, as in moment.js.
const parseDate: DateParser = (text, format) => {
  const parts = format.match(/YYYY|MM|DD|[^YMD]+/gu) ?? []
  const pattern = parts
    .map((part) =>
      part === 'YYYY' ? '(\\d{4})' : part === 'MM' || part === 'DD' ? '(\\d{2})' : part.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'),
    )
    .join('')
  const match = new RegExp(`^${pattern}$`, 'u').exec(text)
  if (!match) {
    return null
  }
  const values: Record<string, string> = {}
  parts.filter((part) => ['YYYY', 'MM', 'DD'].includes(part)).forEach((token, index) => {
    values[token] = match[index + 1]
  })
  return `${values.YYYY}-${values.MM}-${values.DD}`
}

describe('getDailyNoteDate', () => {
  const config = { folder: 'periodic/daily', format: 'YYYY-MM-DD', template: null }

  test.each([
    ['periodic/daily/2026-10-30.md', '2026-10-30'],
    ['periodic/daily/2025/2025-01-02.md', '2025-01-02'],
    ['periodic/daily/meta.md', null],
    ['notes/2026-10-30.md', null],
    ['periodic/daily-old/2026-10-30.md', null],
    ['periodic/daily/2026-10-30.canvas', null],
  ])('reads %s as %s', (filePath, date) => {
    expect(getDailyNoteDate(config, filePath, parseDate)).toBe(date)
  })

  test('accepts notes anywhere when daily notes live in the vault root', () => {
    expect(getDailyNoteDate({ ...config, folder: '' }, 'archive/2026-10-30.md', parseDate)).toBe('2026-10-30')
  })

  test('reads folders when the format names them', () => {
    const nested = { folder: 'journal', format: 'YYYY/MM/YYYY-MM-DD', template: null }
    expect(getDailyNoteDate(nested, 'journal/2026/10/2026-10-30.md', parseDate)).toBe('2026-10-30')
    expect(getDailyNoteDate(nested, 'journal/2026-10-30.md', parseDate)).toBeNull()
  })
})

describe('Tasks plugin defaults', () => {
  test.each([
    [null, { taskFormat: null, setCreatedDate: null }],
    [{ taskFormat: 'dataview', setCreatedDate: true }, { taskFormat: 'dataview', setCreatedDate: true }],
    [{ taskFormat: 'tasksPluginEmoji' }, { taskFormat: 'emoji', setCreatedDate: null }],
    [{ taskFormat: 'other', setCreatedDate: 'yes' }, { taskFormat: null, setCreatedDate: null }],
  ])('reads %j', (json, expected) => {
    expect(parseTasksPluginDefaults(json)).toEqual(expected)
  })
})
