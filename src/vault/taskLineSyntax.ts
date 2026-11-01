// The syntax of one task line: its status, Tasks and Dataview metadata, tags,
// inline fields and links. `taskLine.ts` uses it to edit lines.

import type {
  TaskDateField,
  TaskLink,
  TaskPriority,
  TaskStatus,
} from '@shared/taskTypes'
import type { Settings } from '@shared/settingsTypes'
import { findComments, type TaskCommentRange } from './taskComments'
import { extractLinks } from './taskLinks'

export type TaskFormat = Settings['taskFormat']

export type TaskField = TaskDateField | 'priority'

type TaskMetadataToken = {
  start: number
  end: number
  field: TaskField
  value: string
  format: TaskFormat
  bracket: '[' | '('
}

export type ParsedTaskLine = {
  prefix: string
  statusSymbol: string
  separator: string
  body: string
  tokens: TaskMetadataToken[]
  // Index in `body` where a trailing block reference such as ` ^abc123` starts.
  blockIdStart: number | null
  description: string
  status: TaskStatus
  priority: TaskPriority
  dates: Record<TaskDateField, string | null>
  tags: string[]
  // Visible Dataview inline fields (`[key:: value]`) other than the ones above, by lowercase key.
  fields: Record<string, string>
  links: TaskLink[]
  // Comments are not part of the description, its tags or its links.
  comments: TaskCommentRange[]
}

// `- [ ] text`, `* [x] text`, `1. [/] text`, also inside blockquotes and callouts.
const taskLinePattern = /^([ \t>]*(?:[-*+]|\d+[.)])[ \t]+)\[(.)\](?:([ \t]+)(.*))?$/u

const emojiDateFields: Record<string, TaskDateField> = {
  '📅': 'dueDate',
  '📆': 'dueDate',
  '🗓': 'dueDate',
  '⏳': 'scheduledDate',
  '⌛': 'scheduledDate',
  '🛫': 'startDate',
  '➕': 'createdDate',
  '✅': 'doneDate',
  '❌': 'cancelledDate',
}

const emojiForDateField: Record<TaskDateField, string> = {
  dueDate: '📅',
  scheduledDate: '⏳',
  startDate: '🛫',
  createdDate: '➕',
  doneDate: '✅',
  cancelledDate: '❌',
}

const emojiPriorities: Record<string, TaskPriority> = {
  '🔺': 'highest',
  '⏫': 'high',
  '🔼': 'medium',
  '🔽': 'low',
  '⏬': 'lowest',
}

const emojiForPriority: Partial<Record<TaskPriority, string>> = {
  highest: '🔺',
  high: '⏫',
  medium: '🔼',
  low: '🔽',
  lowest: '⏬',
}

const dataviewDateFields: Record<string, TaskDateField> = {
  due: 'dueDate',
  scheduled: 'scheduledDate',
  start: 'startDate',
  created: 'createdDate',
  completion: 'doneDate',
  cancelled: 'cancelledDate',
}

const dataviewKeyForField: Record<TaskField, string> = {
  dueDate: 'due',
  scheduledDate: 'scheduled',
  startDate: 'start',
  createdDate: 'created',
  doneDate: 'completion',
  cancelledDate: 'cancelled',
  priority: 'priority',
}

const dataviewPriorities = new Set<string>([
  'highest',
  'high',
  'medium',
  'normal',
  'low',
  'lowest',
])

const statusForSymbol: Record<string, TaskStatus> = {
  ' ': 'todo',
  x: 'done',
  X: 'done',
  '/': 'in_progress',
  '-': 'cancelled',
}

export const symbolForStatus: Record<TaskStatus, string> = {
  todo: ' ',
  done: 'x',
  in_progress: '/',
  cancelled: '-',
}

const datePattern = '\\d{4}-\\d{2}-\\d{2}'
const dataviewKeys = 'due|scheduled|start|created|completion|cancelled|priority'
const builtInFieldKeys = new Set(dataviewKeys.split('|'))

// `[key:: value]`, the inline field form whose key Dataview shows. Keys are words,
// so code and log text such as `[CFrame.cpp->CFrame::Init]` is not a field.
// A value may hold wiki links.
const inlineFieldPattern =
  /\[(?<key>[\p{L}\p{N}\p{Emoji_Presentation}_/-][\p{L}\p{N}\p{Emoji_Presentation} _/-]*?)::[ \t]*(?<value>(?:\[\[[^\]]*\]\]|[^[\]])*?)[ \t]*\]/gu

const metadataPattern = new RegExp(
  [
    `(?<emojiDate>(?<dateEmoji>📅|📆|🗓|⏳|⌛|🛫|➕|✅|❌)\\uFE0F?[ \\t]*(?<emojiDateValue>${datePattern}))`,
    `(?<priorityEmoji>🔺|⏫|🔼|🔽|⏬)\\uFE0F?`,
    `\\[(?<squareKey>${dataviewKeys})::[ \\t]*(?<squareValue>[^\\]]*?)[ \\t]*\\]`,
    `\\((?<roundKey>${dataviewKeys})::[ \\t]*(?<roundValue>[^)]*?)[ \\t]*\\)`,
  ].join('|'),
  'gu',
)

// Wiki links, markdown links and inline code hold text, never task metadata.
const protectedPattern = /\[\[[^\]]*\]\]|\[[^\]]*\]\([^)]*\)|`[^`]*`/gu

const tagPattern = /(?:^|\s)#([\p{L}\p{N}_/-]+)/gu

export const blockIdPattern = /[ \t]+\^[A-Za-z0-9-]+[ \t]*$/u

const getProtectedRanges = (body: string): Array<[number, number]> =>
  [...body.matchAll(protectedPattern)].map((match) => [
    match.index,
    match.index + match[0].length,
  ])

const isInsideRanges = (
  ranges: Array<[number, number]>,
  start: number,
  end: number,
): boolean => ranges.some(([rangeStart, rangeEnd]) => start < rangeEnd && end > rangeStart)

const isIsoDate = (value: string): boolean =>
  new RegExp(`^${datePattern}$`).test(value)

const toMetadataToken = (match: RegExpMatchArray): TaskMetadataToken | null => {
  const groups = match.groups ?? {}
  const start = match.index ?? 0
  const end = start + match[0].length

  if (groups.dateEmoji && groups.emojiDateValue) {
    return {
      start,
      end,
      field: emojiDateFields[groups.dateEmoji],
      value: groups.emojiDateValue,
      format: 'emoji',
      bracket: '[',
    }
  }

  if (groups.priorityEmoji) {
    return {
      start,
      end,
      field: 'priority',
      value: emojiPriorities[groups.priorityEmoji],
      format: 'emoji',
      bracket: '[',
    }
  }

  const key = groups.squareKey ?? groups.roundKey
  const value = (groups.squareValue ?? groups.roundValue ?? '').trim()
  const bracket = groups.squareKey ? '[' : '('

  if (key === 'priority') {
    const priority = value.toLowerCase()
    return dataviewPriorities.has(priority)
      ? { start, end, field: 'priority', value: priority, format: 'dataview', bracket }
      : null
  }

  if (key && isIsoDate(value)) {
    return {
      start,
      end,
      field: dataviewDateFields[key],
      value,
      format: 'dataview',
      bracket,
    }
  }

  return null
}

export const collapseWhitespace = (text: string): string =>
  text.replace(/\s+/gu, ' ').trim()

// The body without the metadata and comments in `ranges`, which are in order.
const getDescription = (
  body: string,
  ranges: Array<{ start: number; end: number }>,
  blockIdStart: number | null,
): string => {
  const content = blockIdStart === null ? body : body.slice(0, blockIdStart)
  let description = ''
  let cursor = 0

  for (const range of ranges) {
    description += `${content.slice(cursor, range.start)} `
    cursor = range.end
  }

  return collapseWhitespace(description + content.slice(cursor))
}

export type TagRange = { tag: string; start: number; end: number }

// Every `#tag` in `text` outside links and inline code, from its `#` to its end.
export const findTagRanges = (text: string): TagRange[] => {
  const withoutProtected = text.replace(protectedPattern, (match) => ' '.repeat(match.length))

  return [...withoutProtected.matchAll(tagPattern)].flatMap((match) => {
    const tag = match[1]
    const end = match.index + match[0].length
    // Obsidian tags need at least one character that is not a digit.
    return /[^\p{N}]/u.test(tag) ? [{ tag, start: end - tag.length - 1, end }] : []
  })
}

export const extractTags = (description: string): string[] => [
  ...new Set(findTagRanges(description).map((range) => range.tag)),
]

// Dataview reads `Type` and `type` as one field.
const normalizeFieldKey = (key: string): string => key.trim().replace(/\s+/gu, ' ').toLocaleLowerCase()

const extractInlineFields = (
  body: string,
  protectedRanges: Array<[number, number]>,
  commentRanges: Array<[number, number]>,
): Record<string, string> => {
  const fields: Record<string, string> = {}

  for (const match of body.matchAll(inlineFieldPattern)) {
    const start = match.index
    const end = start + match[0].length
    // A field may hold a link, but must not start or end inside a link or inline code.
    const isProtected = protectedRanges.some(
      ([from, to]) => (start > from && start < to) || (end > from && end < to),
    )
    const key = normalizeFieldKey(match.groups?.key ?? '')

    if (isProtected || isInsideRanges(commentRanges, start, end) || key === '' || builtInFieldKeys.has(key)) {
      continue
    }

    const value = (match.groups?.value ?? '').trim()
    // A repeated key keeps every value, as Dataview lists them.
    fields[key] = key in fields ? `${fields[key]}, ${value}` : value
  }

  return fields
}

export const parseTaskLine = (line: string): ParsedTaskLine | null => {
  const match = taskLinePattern.exec(line)

  if (!match) {
    return null
  }

  const [, prefix, statusSymbol, separator = '', body = ''] = match
  const blockIdMatch = blockIdPattern.exec(body)
  const blockIdStart = blockIdMatch ? blockIdMatch.index : null
  const searchableBody = blockIdStart === null ? body : body.slice(0, blockIdStart)
  const protectedRanges = getProtectedRanges(searchableBody)
  const comments = findComments(searchableBody, protectedRanges)
  const commentRanges = comments.map((comment): [number, number] => [comment.start, comment.end])
  // Metadata written inside a comment, such as "moved to 📅 2026-11-05", is text.
  const tokens = [...searchableBody.matchAll(metadataPattern)]
    .filter((tokenMatch) =>
      !isInsideRanges(
        [...protectedRanges, ...commentRanges],
        tokenMatch.index,
        tokenMatch.index + tokenMatch[0].length,
      ),
    )
    .map(toMetadataToken)
    .filter((token): token is TaskMetadataToken => token !== null)

  const dates: Record<TaskDateField, string | null> = {
    dueDate: null,
    scheduledDate: null,
    startDate: null,
    createdDate: null,
    doneDate: null,
    cancelledDate: null,
  }
  let priority: TaskPriority = 'normal'

  for (const token of tokens) {
    if (token.field === 'priority') {
      priority = token.value as TaskPriority
    } else {
      dates[token.field] ??= token.value
    }
  }

  const description = getDescription(
    body,
    [...tokens, ...comments].sort((first, second) => first.start - second.start),
    blockIdStart,
  )

  return {
    prefix,
    statusSymbol,
    separator,
    body,
    tokens,
    blockIdStart,
    description,
    status: statusForSymbol[statusSymbol] ?? 'todo',
    priority,
    dates,
    tags: extractTags(description),
    fields: extractInlineFields(searchableBody, protectedRanges, commentRanges),
    links: extractLinks(description),
    comments,
  }
}

// Dataview fields with a hidden key, `(key:: value)`.
const roundFieldPattern =
  /\([\p{L}\p{N}\p{Emoji_Presentation}_/-][\p{L}\p{N}\p{Emoji_Presentation} _/-]*?::[^()]*\)/gu

// Tasks plugin fields that are not read here: recurrence, id, depends on and on completion.
const otherTasksFieldPattern =
  /🔁\uFE0F?[ \t]*[a-zA-Z0-9, !]+|🆔\uFE0F?[ \t]*[a-zA-Z0-9_-]+|⛔\uFE0F?[ \t]*[a-zA-Z0-9_-]+(?:[ \t]*,[ \t]*[a-zA-Z0-9_-]+)*|🏁\uFE0F?[ \t]*[a-zA-Z]+/gu

// Where the task's own text ends in `body`: before the metadata, inline fields,
// comments and block id that follow it. The Tasks plugin writes new tags there too.
export const getDescriptionEnd = (parsed: ParsedTaskLine): number => {
  const { body } = parsed
  const fieldRanges = [
    ...[...parsed.tokens, ...parsed.comments].map((range): [number, number] => [range.start, range.end]),
    ...[inlineFieldPattern, roundFieldPattern, otherTasksFieldPattern].flatMap((pattern) =>
      [...body.matchAll(pattern)].map((match): [number, number] => [
        match.index,
        match.index + match[0].trimEnd().length,
      ]),
    ),
  ]
  let end = parsed.blockIdStart ?? body.length
  let field: [number, number] | undefined

  do {
    while (end > 0 && /\s/u.test(body[end - 1])) {
      end -= 1
    }
    field = fieldRanges.find(([start, fieldEnd]) => fieldEnd === end && start < end)
    if (field) {
      end = field[0]
    }
  } while (field)

  return end
}

export const formatToken = (
  field: TaskField,
  value: string,
  format: TaskFormat,
  bracket: '[' | '(',
): string => {
  if (format === 'emoji') {
    return field === 'priority'
      ? (emojiForPriority[value as TaskPriority] ?? '')
      : `${emojiForDateField[field]} ${value}`
  }

  const closing = bracket === '[' ? ']' : ')'
  return `${bracket}${dataviewKeyForField[field]}:: ${value}${closing}`
}
