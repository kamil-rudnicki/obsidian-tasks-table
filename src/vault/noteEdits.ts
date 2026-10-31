import { getLineEnding, splitLines } from './noteTasks'

const headingPattern = /^(#{1,6})[ \t]+(.*?)[ \t#]*$/u

const normalizeHeading = (heading: string): string =>
  heading.replace(/^#+/u, '').trim().toLocaleLowerCase()

type SplitContent = {
  lines: string[]
  lineEnding: string
  hasTrailingNewline: boolean
}

const splitContent = (content: string): SplitContent => {
  const lineEnding = getLineEnding(content)

  if (content === '') {
    return { lines: [], lineEnding, hasTrailingNewline: true }
  }

  const lines = splitLines(content)
  const hasTrailingNewline = lines[lines.length - 1] === ''

  return {
    lines: hasTrailingNewline ? lines.slice(0, -1) : lines,
    lineEnding,
    hasTrailingNewline,
  }
}

const joinContent = ({ lines, lineEnding, hasTrailingNewline }: SplitContent): string =>
  lines.join(lineEnding) + (hasTrailingNewline ? lineEnding : '')

const findLastContentLine = (lines: string[], from: number, to: number): number => {
  for (let index = to - 1; index >= from; index -= 1) {
    if (lines[index].trim() !== '') {
      return index
    }
  }
  return from - 1
}

// Adds the lines at the end of the heading's section, or at the end of the note.
// Returns the index of the first added line.
export const insertTaskLines = (
  content: string,
  newLines: string[],
  heading: string,
): { content: string; line: number } => {
  const split = splitContent(content)
  const { lines } = split
  const wantedHeading = normalizeHeading(heading)
  let insertAt = findLastContentLine(lines, 0, lines.length) + 1

  if (wantedHeading !== '') {
    const headingIndex = lines.findIndex((text) => {
      const match = headingPattern.exec(text)
      return match !== null && normalizeHeading(match[2]) === wantedHeading
    })

    if (headingIndex !== -1) {
      const level = headingPattern.exec(lines[headingIndex])?.[1].length ?? 1
      let sectionEnd = lines.length

      for (let index = headingIndex + 1; index < lines.length; index += 1) {
        const match = headingPattern.exec(lines[index])
        if (match && match[1].length <= level) {
          sectionEnd = index
          break
        }
      }

      insertAt = findLastContentLine(lines, headingIndex + 1, sectionEnd) + 1
    }
  }

  lines.splice(insertAt, 0, ...newLines)

  return { content: joinContent(split), line: insertAt }
}

const nestingPattern = /^[ \t>]*/u

export type TaskBlock = {
  start: number
  // Index after the block's last line.
  end: number
  // The block without the nesting the task itself had, ready for the top level of a note.
  lines: string[]
}

// A task line with the lines nested under it: subtasks and notes. Blank lines
// belong to the block only when more nested lines follow them.
export const getTaskBlock = (content: string, line: number): TaskBlock => {
  const { lines } = splitContent(content)
  const nesting = nestingPattern.exec(lines[line])?.[0] ?? ''
  const isNested = (text: string): boolean =>
    text.startsWith(nesting) && /^[ \t]/u.test(text.slice(nesting.length))
  let end = line + 1

  for (let index = line + 1; index < lines.length; index += 1) {
    if (isNested(lines[index])) {
      end = index + 1
    } else if (lines[index].trim() !== '') {
      break
    }
  }

  return {
    start: line,
    end,
    lines: lines.slice(line, end).map((text) => (text.trim() === '' ? '' : text.slice(nesting.length))),
  }
}

export const removeLines = (content: string, start: number, end: number): string => {
  const split = splitContent(content)
  split.lines.splice(start, end - start)
  return joinContent(split)
}

export const replaceLine = (content: string, lineIndex: number, line: string | null): string => {
  const split = splitContent(content)

  if (line === null) {
    split.lines.splice(lineIndex, 1)
  } else {
    split.lines[lineIndex] = line
  }

  return joinContent(split)
}

// Finds the task's line again when the note changed after indexing.
export const locateLine = (content: string, expectedLine: number, raw: string): number | null => {
  const lines = splitLines(content)

  if (lines[expectedLine] === raw) {
    return expectedLine
  }

  let nearest: number | null = null
  lines.forEach((text, index) => {
    if (
      text === raw &&
      (nearest === null || Math.abs(index - expectedLine) < Math.abs(nearest - expectedLine))
    ) {
      nearest = index
    }
  })

  return nearest
}
