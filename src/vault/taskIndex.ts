import { compareTags, getInlineFieldKey, type Task, type TaskListQuery, type TaskOptionsInput } from '@shared/taskTypes'
import type { IndexedTask } from './noteTasks'
import { createTaskComparator, createTaskPredicate, type TaskQueryContext } from './taskQuery'

export type NoteState = {
  path: string
  mtimeMs: number
  size: number
}

type NoteEntry = {
  state: NoteState
  tasks: IndexedTask[]
  signature: string
}

// Bounds the answer for vaults with very many tags.
const maxTagOptions = 1000

const getSignature = (tasks: IndexedTask[]): string =>
  tasks.map((task) => `${task.id}:${task.line}:${task.raw}`).join('\n')

export const toPublicTask = ({ raw: _raw, ...task }: IndexedTask): Task => task

// The tasks of every note, held in memory. The Markdown notes are the only
// source of tasks; this index is rebuilt from them on every start.
export class TaskIndex {
  private readonly notes = new Map<string, NoteEntry>()
  private readonly tasksById = new Map<string, IndexedTask>()

  getNoteStates(): Map<string, NoteState> {
    return new Map([...this.notes].map(([notePath, entry]) => [notePath, entry.state]))
  }

  // Returns true when the note's tasks differ from what the index held.
  replaceNoteTasks(state: NoteState, tasks: IndexedTask[]): boolean {
    const previous = this.notes.get(state.path)
    const signature = getSignature(tasks)

    if (previous) {
      for (const task of previous.tasks) {
        this.tasksById.delete(task.id)
      }
    }

    this.notes.set(state.path, { state, tasks, signature })
    for (const task of tasks) {
      this.tasksById.set(task.id, task)
    }

    return (previous?.signature ?? '') !== signature
  }

  // Returns true when any removed note had tasks.
  deleteNotes(paths: string[]): boolean {
    let removedTasks = false

    for (const notePath of paths) {
      const entry = this.notes.get(notePath)
      if (!entry) {
        continue
      }
      removedTasks ||= entry.tasks.length > 0
      for (const task of entry.tasks) {
        this.tasksById.delete(task.id)
      }
      this.notes.delete(notePath)
    }

    return removedTasks
  }

  clear(): void {
    this.notes.clear()
    this.tasksById.clear()
  }

  listTasks(query: TaskListQuery, today: string, context: TaskQueryContext): Task[] {
    const matches = createTaskPredicate(query, today, context)
    const tasks: IndexedTask[] = []

    for (const entry of this.notes.values()) {
      for (const task of entry.tasks) {
        if (matches(task)) {
          tasks.push(task)
        }
      }
    }

    return tasks.sort(createTaskComparator(query.sorting)).map(toPublicTask)
  }

  getTask(id: string): IndexedTask | null {
    return this.tasksById.get(id) ?? null
  }

  getTaskAtLine(notePath: string, line: number): IndexedTask | null {
    return this.notes.get(notePath)?.tasks.find((task) => task.line === line) ?? null
  }

  listOptions({ field, search }: TaskOptionsInput, limit = 50): string[] {
    const query = search.trim().toLocaleLowerCase()
    const matches = (value: string): boolean => value.toLocaleLowerCase().includes(query)
    // Value -> [display value, rank]. A higher rank is listed first; tags are listed by name.
    const options = new Map<string, { value: string; rank: number | string }>()
    const fieldKey = getInlineFieldKey(field)
    // Counts a value without case; the most used values are listed first.
    const count = (value: string): void => {
      const key = value.toLocaleLowerCase()
      const option = options.get(key)
      if (option) {
        option.rank = Number(option.rank) + 1
      } else if (matches(value)) {
        options.set(key, { value, rank: 1 })
      }
    }

    for (const entry of this.notes.values()) {
      for (const task of entry.tasks) {
        if (fieldKey !== null) {
          const value = task.fields[fieldKey]
          if (value) {
            count(value)
          }
        } else if (field === 'tags') {
          task.tags.forEach(count)
        } else if (field === 'note') {
          // Recent daily notes sort last by path, so the latest path ranks first.
          const option = options.get(task.note)
          if (!option && matches(task.note)) {
            options.set(task.note, { value: task.note, rank: task.filePath })
          } else if (option && task.filePath > String(option.rank)) {
            option.rank = task.filePath
          }
        } else if (task.folder !== '') {
          count(task.folder)
        }
      }
    }

    // Tags are listed by name, all of them: a list cut off at some letter would hide tags.
    if (field === 'tags') {
      return [...options.values()]
        .map((option) => option.value)
        .sort(compareTags)
        .slice(0, maxTagOptions)
    }

    return [...options.values()]
      .sort((first, second) =>
        first.rank === second.rank
          ? first.value.localeCompare(second.value)
          : first.rank > second.rank
            ? -1
            : 1,
      )
      .slice(0, limit)
      .map((option) => option.value)
  }

  // The inline field names that tasks use, the most used first.
  listFields(): Array<{ key: string; count: number }> {
    const counts = new Map<string, number>()

    for (const entry of this.notes.values()) {
      for (const task of entry.tasks) {
        for (const key of Object.keys(task.fields)) {
          counts.set(key, (counts.get(key) ?? 0) + 1)
        }
      }
    }

    return [...counts]
      .map(([key, count]) => ({ key, count }))
      .sort((first, second) => second.count - first.count || first.key.localeCompare(second.key))
  }

  // Counts only notes that hold tasks.
  getCounts(): { taskCount: number; noteCount: number } {
    let noteCount = 0
    for (const entry of this.notes.values()) {
      if (entry.tasks.length > 0) {
        noteCount += 1
      }
    }
    return { taskCount: this.tasksById.size, noteCount }
  }
}
