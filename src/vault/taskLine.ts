import type { TaskChanges, TaskComment, TaskStatus } from '@shared/taskTypes'
import { formatComment } from './taskComments'
import {
  blockIdPattern,
  collapseWhitespace,
  findTagRanges,
  formatToken,
  getDescriptionEnd,
  parseTaskLine,
  symbolForStatus,
  type ParsedTaskLine,
  type TagRange,
  type TaskField,
  type TaskFormat,
} from './taskLineSyntax'

const serialize = (parsed: ParsedTaskLine, statusSymbol: string, body: string): string =>
  `${parsed.prefix}[${statusSymbol}]${body ? `${parsed.separator || ' '}${body}` : ''}`

const removeRange = (body: string, start: number, end: number): string => {
  // Remove one neighbouring space with the token so the words around it stay
  // separated by exactly the whitespace the user wrote.
  if (start > 0 && /[ \t]/u.test(body[start - 1])) {
    return body.slice(0, start - 1) + body.slice(end)
  }

  if (/[ \t]/u.test(body[end] ?? '')) {
    return body.slice(0, start) + body.slice(end + 1)
  }

  return body.slice(0, start) + body.slice(end)
}

// Puts `text` into `body` at `index` as a word of its own.
const insertWord = (body: string, index: number, text: string): string => {
  const before = body.slice(0, index)
  const after = body.slice(index)
  return `${before}${before === '' ? '' : ' '}${text}${after === '' || /^\s/u.test(after) ? '' : ' '}${after}`
}

const setField = (
  line: string,
  field: TaskField,
  value: string | null,
  format: TaskFormat,
): string => {
  const parsed = parseTaskLine(line)

  if (!parsed) {
    return line
  }

  const fieldTokens = parsed.tokens.filter((token) => token.field === field)
  // Normal priority is the absence of a priority marker in both formats.
  const nextValue = field === 'priority' && value === 'normal' ? null : value
  let body = parsed.body

  // Walk from the end so earlier token positions stay valid.
  const [firstToken, ...otherTokens] = fieldTokens
  for (const token of [...otherTokens].reverse()) {
    body = removeRange(body, token.start, token.end)
  }

  if (firstToken) {
    const replacement = nextValue === null
      ? null
      : formatToken(field, nextValue, firstToken.format, firstToken.bracket)
    body = replacement === null || replacement === ''
      ? removeRange(body, firstToken.start, firstToken.end)
      : body.slice(0, firstToken.start) + replacement + body.slice(firstToken.end)
  } else if (nextValue !== null) {
    const token = formatToken(field, nextValue, format, '[')
    const blockIdMatch = blockIdPattern.exec(body)
    const insertAt = blockIdMatch ? blockIdMatch.index : body.trimEnd().length
    body = `${body.slice(0, insertAt)} ${token}${body.slice(insertAt)}`
  }

  return serialize(parsed, parsed.statusSymbol, body)
}

const setStatus = (line: string, status: TaskStatus): string => {
  const parsed = parseTaskLine(line)

  if (!parsed || parsed.status === status) {
    return line
  }

  return serialize(parsed, symbolForStatus[status], parsed.body)
}

const setDescription = (line: string, description: string): string => {
  const parsed = parseTaskLine(line)

  if (!parsed) {
    return line
  }

  // The metadata and comments stay, in the order they are written.
  const metadata = [...parsed.tokens, ...parsed.comments]
    .sort((first, second) => first.start - second.start)
    .map((range) => ` ${parsed.body.slice(range.start, range.end)}`)
    .join('')
  const blockId = parsed.blockIdStart === null
    ? ''
    : parsed.body.slice(parsed.blockIdStart).trimEnd()

  return serialize(
    parsed,
    parsed.statusSymbol,
    `${collapseWhitespace(description)}${metadata}${blockId}`,
  )
}

// The task's own tags, outside its comments, each at its first place in the text.
const findTaskTagRanges = (parsed: ParsedTaskLine): TagRange[] => {
  const seen = new Set<string>()
  return findTagRanges(parsed.body.slice(0, parsed.blockIdStart ?? parsed.body.length)).filter((range) => {
    const isInComment = parsed.comments.some((comment) => range.start > comment.start && range.end < comment.end)
    if (isInComment || seen.has(range.tag)) {
      return false
    }
    seen.add(range.tag)
    return true
  })
}

// Puts the tags in the order of `order`. The tags keep their places in the
// text and only swap names, so the words around them stay as written.
const orderTags = (line: string, order: string[]): string => {
  const parsed = parseTaskLine(line)

  if (!parsed) {
    return line
  }

  const ranges = findTaskTagRanges(parsed)
  const wanted = order.filter((tag) => ranges.some((range) => range.tag === tag))

  if (wanted.length !== ranges.length || wanted.every((tag, index) => tag === ranges[index].tag)) {
    return line
  }

  let body = parsed.body
  // Walk from the end so earlier tag positions stay valid.
  for (let index = ranges.length - 1; index >= 0; index -= 1) {
    body = `${body.slice(0, ranges[index].start)}#${wanted[index]}${body.slice(ranges[index].end)}`
  }

  return serialize(parsed, parsed.statusSymbol, body)
}

// Removes the tags that are not in `tags` wherever they are, adds the new ones
// after the task's text, before its metadata, and puts them all in the order
// of `tags`. Tags in comments stay.
const setTags = (line: string, tags: string[]): string => {
  const parsed = parseTaskLine(line)

  if (!parsed) {
    return line
  }

  const kept = new Set(tags)
  let body = parsed.body
  // Walk from the end so earlier tag positions stay valid.
  for (const range of findTagRanges(body.slice(0, parsed.blockIdStart ?? body.length)).reverse()) {
    const isInComment = parsed.comments.some((comment) => range.start > comment.start && range.end < comment.end)
    if (!kept.has(range.tag) && !isInComment) {
      body = removeRange(body, range.start, range.end)
    }
  }

  const added = [...kept].filter((tag) => !parsed.tags.includes(tag))
  const withoutRemoved = parseTaskLine(serialize(parsed, parsed.statusSymbol, body))

  if (added.length === 0 || !withoutRemoved) {
    return orderTags(serialize(parsed, parsed.statusSymbol, body), tags)
  }

  const tagText = added.map((tag) => `#${tag}`).join(' ')
  const withAdded = serialize(
    withoutRemoved,
    withoutRemoved.statusSymbol,
    insertWord(withoutRemoved.body, getDescriptionEnd(withoutRemoved), tagText),
  )

  return orderTags(withAdded, tags)
}

// A new comment goes after the task's last comment, or after its text when it
// has none. Either way the Tasks metadata stays at the end of the line, where
// the Tasks plugin reads it.
export const addTaskComment = (line: string, comment: TaskComment): string => {
  const parsed = parseTaskLine(line)

  if (!parsed) {
    return line
  }

  const end = parsed.comments.at(-1)?.end ?? getDescriptionEnd(parsed)
  return serialize(parsed, parsed.statusSymbol, insertWord(parsed.body, end, formatComment(comment)))
}

export type TaskChangeOptions = {
  format: TaskFormat
  today: string
  setDoneDate: boolean
}

export const applyTaskChanges = (
  line: string,
  changes: TaskChanges,
  options: TaskChangeOptions,
): string => {
  const original = parseTaskLine(line)

  if (!original) {
    return line
  }

  let next = line

  if (changes.description !== undefined) {
    next = setDescription(next, changes.description)
  }

  if (changes.tags !== undefined) {
    next = setTags(next, changes.tags)
  }

  if (changes.status !== undefined && changes.status !== original.status) {
    next = setStatus(next, changes.status)

    if (changes.status === 'done') {
      if (options.setDoneDate && !original.dates.doneDate) {
        next = setField(next, 'doneDate', options.today, options.format)
      }
    } else if (original.dates.doneDate) {
      next = setField(next, 'doneDate', null, options.format)
    }

    if (changes.status === 'cancelled') {
      if (options.setDoneDate && !original.dates.cancelledDate) {
        next = setField(next, 'cancelledDate', options.today, options.format)
      }
    } else if (original.dates.cancelledDate) {
      next = setField(next, 'cancelledDate', null, options.format)
    }
  }

  if (changes.priority !== undefined) {
    next = setField(next, 'priority', changes.priority, options.format)
  }

  if (changes.dueDate !== undefined) {
    next = setField(next, 'dueDate', changes.dueDate, options.format)
  }

  if (changes.scheduledDate !== undefined) {
    next = setField(next, 'scheduledDate', changes.scheduledDate, options.format)
  }

  if (changes.startDate !== undefined) {
    next = setField(next, 'startDate', changes.startDate, options.format)
  }

  return next
}

export const createTaskLine = (
  description: string,
  changes: Omit<TaskChanges, 'description' | 'status'>,
  options: TaskChangeOptions & { setCreatedDate: boolean },
): string => {
  const line = applyTaskChanges(`- [ ] ${collapseWhitespace(description)}`, changes, options)
  return options.setCreatedDate ? setField(line, 'createdDate', options.today, options.format) : line
}
