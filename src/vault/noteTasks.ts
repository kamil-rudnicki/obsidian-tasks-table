import { hashString } from '@shared/hash'
import type { Task } from '@shared/taskTypes'
import { createListLevelReader } from './listLevels'
import { parseTaskLine } from './taskLineSyntax'

export type IndexedTask = Task & { raw: string }

export const splitLines = (content: string): string[] => content.split(/\r?\n/u)

export const getLineEnding = (content: string): string =>
  content.includes('\r\n') ? '\r\n' : '\n'

export const getNoteName = (filePath: string): string =>
  filePath.slice(filePath.lastIndexOf('/') + 1).replace(/\.md$/iu, '')

export const getNoteFolder = (filePath: string): string => {
  const separator = filePath.lastIndexOf('/')
  return separator === -1 ? '' : filePath.slice(0, separator)
}

// Status and metadata edits keep the id; only a new description or a move to
// another note changes it. Equal tasks in one note differ by occurrence.
export const createTaskId = (
  filePath: string,
  description: string,
  occurrence: number,
): string =>
  hashString(`${filePath}\u0000${description}\u0000${occurrence}`)

const fencePattern = /^[ \t>]*(`{3,}|~{3,})/u

export const parseNoteTasks = (
  filePath: string,
  content: string,
): IndexedTask[] => {
  const lines = splitLines(content)
  const tasks: IndexedTask[] = []
  const occurrences = new Map<string, number>()
  const note = getNoteName(filePath)
  const folder = getNoteFolder(filePath)
  const readListLevel = createListLevelReader()
  let fence: string | null = null
  let lineIndex = 0

  if (lines[0]?.trim() === '---') {
    const frontmatterEnd = lines.findIndex(
      (line, index) => index > 0 && /^(---|\.\.\.)\s*$/u.test(line),
    )
    lineIndex = frontmatterEnd === -1 ? 0 : frontmatterEnd + 1
  }

  for (; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]
    const fenceMatch = fencePattern.exec(line)

    if (fenceMatch) {
      const marker = fenceMatch[1]
      if (fence === null) {
        fence = marker
      } else if (marker[0] === fence[0] && marker.length >= fence.length) {
        fence = null
      }
      continue
    }

    if (fence !== null) {
      continue
    }

    const level = readListLevel(line)
    const parsed = parseTaskLine(line)

    if (!parsed || parsed.description === '') {
      continue
    }

    const occurrence = occurrences.get(parsed.description) ?? 0
    occurrences.set(parsed.description, occurrence + 1)

    tasks.push({
      id: createTaskId(filePath, parsed.description, occurrence),
      filePath,
      note,
      folder,
      line: lineIndex,
      // Every task line is a list item, so the reader always has its level.
      level: level ?? 1,
      raw: line,
      description: parsed.description,
      status: parsed.status,
      statusSymbol: parsed.statusSymbol,
      priority: parsed.priority,
      ...parsed.dates,
      tags: parsed.tags,
      fields: parsed.fields,
      links: parsed.links,
      comments: parsed.comments.map(({ time, text }) => ({ time, text })),
    })
  }

  return tasks
}
