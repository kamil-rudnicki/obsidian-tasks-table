import { addDays, parseIsoDate } from '@shared/dateLogic'
import type { Task, TaskChanges } from '@shared/taskTypes'

const tagPattern = /(^|\s)#[\p{L}\p{N}_/-]+/gu
const wikiLinkPattern = /\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/gu
const markdownLinkPattern = /\[([^\]]*)\]\([^)]*\)/gu
// `[key:: value]` and `(key:: value)`; a value may hold wiki links.
const inlineFieldPattern = /[[(][^[\]():]+?::[ \t]*(?:\[\[[^\]]*\]\]|[^[\]()])*?[\])]/gu
// Tasks plugin markers left without a value, such as a lone `🛫`.
const strayMarkerPattern = /(^|\s)(?:📅|📆|🗓|⏳|⌛|🛫|➕|✅|❌|🔁|🏁|🆔|⛔)\uFE0F?(?=\s|$)/gu

// Reads like the rendered note: links show their text, tags and inline fields are hidden.
export const getDisplayTitle = (description: string): string => {
  const title = description
    .replace(inlineFieldPattern, ' ')
    .replace(strayMarkerPattern, '$1')
    .replace(wikiLinkPattern, (_match, target: string, alias?: string) =>
      (alias ?? target.split('#')[0].split('/').pop() ?? target).trim(),
    )
    .replace(markdownLinkPattern, '$1')
    .replace(tagPattern, '$1')
    .replace(/\s+/gu, ' ')
    .trim()

  return title === '' ? description : title
}

const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const monthDayYear = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})
const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' })

export const formatTaskDate = (isoDate: string, today: string): string => {
  if (isoDate === today) {
    return 'Today'
  }
  if (isoDate === addDays(today, 1)) {
    return 'Tomorrow'
  }
  if (isoDate === addDays(today, -1)) {
    return 'Yesterday'
  }

  const date = parseIsoDate(isoDate)
  if (isoDate > today && isoDate <= addDays(today, 6)) {
    return weekday.format(date)
  }

  return date.getFullYear() === parseIsoDate(today).getFullYear()
    ? monthDay.format(date)
    : monthDayYear.format(date)
}

const commentTimePattern = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/u

// "Today, 14:30" or "Oct 28, 09:12", as written in the note. Other times show as written.
export const formatCommentTime = (time: string, today: string): string => {
  const match = commentTimePattern.exec(time)
  if (!match) {
    return time
  }
  const [, date, clock] = match
  return clock ? `${formatTaskDate(date, today)}, ${clock}` : formatTaskDate(date, today)
}

// An inline field value as it reads in a note: links show their text.
export const getDisplayValue = (value: string): string =>
  value
    .replace(wikiLinkPattern, (_match, target: string, alias?: string) =>
      (alias ?? target.split('#')[0].split('/').pop() ?? target).trim(),
    )
    .replace(markdownLinkPattern, '$1')

export const isOpenTask = (task: Pick<Task, 'status'>): boolean =>
  task.status === 'todo' || task.status === 'in_progress'

export const isOverdue = (task: Pick<Task, 'status' | 'dueDate'>, today: string): boolean =>
  isOpenTask(task) && task.dueDate !== null && task.dueDate < today

// Mirrors what main writes, so the row updates before the note is saved.
export const applyChangesLocally = (
  task: Task,
  changes: TaskChanges,
  options: { today: string; setDoneDate: boolean },
): Task => {
  const next: Task = { ...task, ...changes }

  if (changes.status !== undefined && changes.status !== task.status) {
    next.doneDate = changes.status === 'done'
      ? (task.doneDate ?? (options.setDoneDate ? options.today : null))
      : null
    next.cancelledDate = changes.status === 'cancelled'
      ? (task.cancelledDate ?? (options.setDoneDate ? options.today : null))
      : null
  }

  return next
}
