// Comments on a task, written in its line as Dataview inline fields whose name
// holds the time: `[comment_2026-11-01 14:30:: Called the vendor]`. Dataview
// reads each one as a field of the task, and the Tasks plugin reads them as text.

import type { TaskComment } from '@shared/taskTypes'

// Where a comment is written in the task line's body.
export type TaskCommentRange = TaskComment & { start: number; end: number }

const commentKeyPrefix = 'comment_'
const commentStartPattern = /\[comment_/giu

// Where a field value that starts at `start` ends: at the first `]` outside
// nested brackets, as Dataview reads it. A backslash escapes the next character.
const findValueEnd = (text: string, start: number): number | null => {
  let nesting = 0

  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    if (char === '\\') {
      index += 1
    } else if (char === '[') {
      nesting += 1
    } else if (char === ']') {
      if (nesting === 0) {
        return index
      }
      nesting -= 1
    }
  }

  return null
}

const unescapeText = (text: string): string => text.replace(/\\([[\]\\])/gu, '$1')

// Every comment in `body`, in the order written. A comment cannot start inside
// `protectedRanges`, such as links and inline code.
export const findComments = (body: string, protectedRanges: Array<[number, number]>): TaskCommentRange[] => {
  const comments: TaskCommentRange[] = []
  let searchFrom = 0

  for (const match of body.matchAll(commentStartPattern)) {
    const start = match.index
    if (start < searchFrom || protectedRanges.some(([from, to]) => start > from && start < to)) {
      continue
    }

    const separator = body.indexOf('::', start)
    const key = separator === -1 ? '' : body.slice(start + 1, separator)
    const time = key.slice(commentKeyPrefix.length).trim()
    // Dataview field names hold no brackets.
    const valueEnd = time === '' || /[[\]()]/u.test(key) ? null : findValueEnd(body, separator + 2)

    if (valueEnd !== null) {
      const text = unescapeText(body.slice(separator + 2, valueEnd).trim())
      comments.push({ start, end: valueEnd + 1, time, text })
      searchFrom = valueEnd + 1
    }
  }

  return comments
}

// Text that Dataview reads back unchanged stays as typed, links included.
// Other text, such as text with a lone `]`, has its brackets escaped.
const escapeText = (text: string): string => {
  const readsBack = findValueEnd(`${text}]`, 0) === text.length && unescapeText(text) === text
  return readsBack ? text : text.replace(/[[\]\\]/gu, '\\$&')
}

// A task is one line, so the comment is too.
export const formatComment = ({ time, text }: TaskComment): string =>
  `[${commentKeyPrefix}${time}:: ${escapeText(text.replace(/\s+/gu, ' ').trim())}]`
