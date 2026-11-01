import type { App, TFile } from 'obsidian'
import { getToday, parseIsoDate, toLocalDateTime } from '@shared/dateLogic'
import type { Settings } from '@shared/settingsTypes'
import type { AddTaskCommentInput, CreateTaskInput, Task, TaskChanges, UpdateTaskInput } from '@shared/taskTypes'
import { UserError } from '@shared/userError'
import { getTaskBlock, locateLine, removeLines, replaceLine, type TaskBlock } from './noteEdits'
import { createNoteFiles, normalizeNotePath, type TargetNote } from './noteFiles'
import { splitLines, type IndexedTask } from './noteTasks'
import { toPublicTask, type TaskIndex } from './taskIndex'
import { addTaskComment, applyTaskChanges, createTaskLine, type TaskChangeOptions } from './taskLine'
import type { VaultIndexer } from './vaultIndexer'

type TaskWriterOptions = {
  app: App
  index: TaskIndex
  indexer: VaultIndexer
  getSettings: () => Settings
}

const taskChangedMessage = 'This task changed in the note. The list now shows the latest version.'

// Writes task edits back to the Markdown notes, then re-indexes the notes.
export const createTaskWriter = ({ app, index, indexer, getSettings }: TaskWriterOptions) => {
  const { vault } = app
  const notes = createNoteFiles(app)

  const getChangeOptions = (): TaskChangeOptions => {
    const settings = getSettings()
    return {
      format: settings.taskFormat,
      setDoneDate: settings.setDoneDate,
      today: getToday(),
    }
  }

  const findTask = (id: string) => {
    const task = index.getTask(id)
    const file = task ? notes.getNote(task.filePath) : null

    if (!task || !file) {
      throw new UserError('This task no longer exists. The list now shows the latest notes.')
    }

    return { task, file }
  }

  // Runs `edit` on the task's current line and returns the line it ended on.
  const editTaskLine = async (
    id: string,
    edit: (line: string) => string | null,
  ): Promise<{ notePath: string; line: number }> => {
    const { task, file } = findTask(id)

    // `process` reads and writes the note atomically, also while it is open in an editor.
    const located: { line: number | null } = { line: null }
    const content = await vault.process(file, (data) => {
      const line = locateLine(data, task.line, task.raw)
      located.line = line
      return line === null ? data : replaceLine(data, line, edit(splitLines(data)[line]))
    })

    await indexer.indexContent(file, content)

    if (located.line === null) {
      throw new UserError(taskChangedMessage)
    }

    return { notePath: task.filePath, line: located.line }
  }

  // Reads the task's note and finds the task with its subtasks and notes.
  const readTaskBlock = async (id: string): Promise<{ file: TFile; content: string; block: TaskBlock }> => {
    const { task, file } = findTask(id)
    const content = await vault.read(file)
    const line = locateLine(content, task.line, task.raw)

    if (line === null) {
      await indexer.indexContent(file, content)
      throw new UserError(taskChangedMessage)
    }

    return { file, content, block: getTaskBlock(content, line) }
  }

  // Removes the block only when the note still has the content it was read
  // from, so lines that changed meanwhile are never removed.
  const removeTaskBlock = async (
    file: TFile,
    readContent: string,
    block: TaskBlock,
  ): Promise<{ removed: boolean; content: string }> => {
    let removed = false
    const content = await vault.process(file, (data) => {
      if (data !== readContent) {
        return data
      }
      removed = true
      return removeLines(data, block.start, block.end)
    })
    return { removed, content }
  }

  const getTaskAt = (notePath: string, line: number): Task => {
    const task = index.getTaskAtLine(notePath, line)
    if (!task) {
      throw new UserError('The task was saved, but it could not be read back from the note.')
    }
    return toPublicTask(task)
  }

  // Moves the task, with its subtasks and notes, to `target` and applies `edit`
  // to its line. The task is added to the target first and removed from its
  // note only when that note did not change meanwhile, so it is never lost.
  const moveTask = async (
    task: IndexedTask,
    target: TargetNote,
    edit: (line: string) => string,
  ): Promise<Task> => {
    const { file: source, content: sourceContent, block } = await readTaskBlock(task.id)
    const movedLines = [edit(block.lines[0]), ...block.lines.slice(1)]
    const inserted = await notes.insertIntoNote(target, movedLines, getSettings().newTaskHeading)
    const { removed, content: sourceAfter } = await removeTaskBlock(source, sourceContent, block)

    if (!removed) {
      const targetAfter = await vault.process(inserted.file, (data) =>
        splitLines(data).slice(inserted.line, inserted.line + movedLines.length).join('\n') === movedLines.join('\n')
          ? removeLines(data, inserted.line, inserted.line + movedLines.length)
          : data,
      )
      await indexer.indexContent(inserted.file, targetAfter)
      await indexer.indexContent(source, sourceAfter)
      throw new UserError(taskChangedMessage)
    }

    await indexer.indexContent(source, sourceAfter)
    await indexer.indexContent(inserted.file, inserted.content)
    return getTaskAt(target.notePath, inserted.line)
  }

  // A new start date moves the task to that day's daily note, when the setting is on.
  const getStartDateNote = async (task: IndexedTask, changes: TaskChanges): Promise<TargetNote | null> => {
    if (!getSettings().moveToStartDateNote || !changes.startDate || changes.startDate === task.startDate) {
      return null
    }
    const target = await notes.getDailyNote(parseIsoDate(changes.startDate))
    return target.notePath === task.filePath ? null : target
  }

  const updateTask = ({ id, changes }: UpdateTaskInput): Promise<Task> =>
    indexer.runExclusive(async () => {
      const options = getChangeOptions()
      const edit = (text: string) => applyTaskChanges(text, changes, options)
      const { task } = findTask(id)
      const target = await getStartDateNote(task, changes)

      if (target) {
        return moveTask(task, target, edit)
      }

      const { notePath, line } = await editTaskLine(id, edit)
      return getTaskAt(notePath, line)
    })

  // The comment gets the current local time. The task keeps its id.
  const addComment = ({ id, text }: AddTaskCommentInput): Promise<Task> =>
    indexer.runExclusive(async () => {
      const time = toLocalDateTime(new Date())
      const { notePath, line } = await editTaskLine(id, (taskLine) => addTaskComment(taskLine, { time, text }))
      return getTaskAt(notePath, line)
    })

  const deleteTask = (id: string): Promise<void> =>
    indexer.runExclusive(async () => {
      await editTaskLine(id, () => null)
    })

  // Copies the task, with its subtasks and notes, through `copy` and only then
  // removes it from its note, so a failed copy never loses the task. The
  // copied lines have no nesting, ready to paste at the top level of a note.
  const cutTask = (id: string, copy: (text: string) => Promise<void>): Promise<void> =>
    indexer.runExclusive(async () => {
      const { file, content, block } = await readTaskBlock(id)
      await copy(block.lines.join('\n'))
      const { removed, content: after } = await removeTaskBlock(file, content, block)
      await indexer.indexContent(file, after)

      if (!removed) {
        throw new UserError('The note changed meanwhile. The task was copied, but it is still in its note.')
      }
    })

  const getNewTaskNote = (settings: Settings): Promise<TargetNote> =>
    settings.newTaskTarget === 'note'
      ? Promise.resolve({ notePath: normalizeNotePath(settings.newTaskNotePath), template: '' })
      : notes.getDailyNote(new Date())

  const createTask = ({ description, priority, dueDate }: CreateTaskInput): Promise<Task> =>
    indexer.runExclusive(async () => {
      const settings = getSettings()
      const target = await getNewTaskNote(settings)
      const taskLine = createTaskLine(
        description,
        { priority, dueDate },
        { ...getChangeOptions(), setCreatedDate: settings.setCreatedDate },
      )
      const inserted = await notes.insertIntoNote(target, [taskLine], settings.newTaskHeading)

      await indexer.indexContent(inserted.file, inserted.content)
      return getTaskAt(target.notePath, inserted.line)
    })

  return { updateTask, addComment, deleteTask, cutTask, createTask }
}

export type TaskWriter = ReturnType<typeof createTaskWriter>
