import type { App, TFile } from 'obsidian'
import { getToday, parseIsoDate, toLocalDateTime } from '@shared/dateLogic'
import type { Settings } from '@shared/settingsTypes'
import type { AddTaskCommentInput, CreateTaskInput, EditTaskCommentInput, Task, TaskChanges, UpdateTaskInput } from '@shared/taskTypes'
import { UserError } from '@shared/userError'
import { getTaskBlock, insertLinesAt, locateLine, locateLines, removeLines, replaceLine, type TaskBlock } from './noteEdits'
import { createNoteFiles, normalizeNotePath, type TargetNote } from './noteFiles'
import { splitLines, type IndexedTask } from './noteTasks'
import { toPublicTask, type TaskIndex } from './taskIndex'
import { addTaskComment, applyTaskChanges, createTaskLine, editTaskComment, type TaskChangeOptions } from './taskLine'
import type { TaskQueryContext } from './taskQuery'
import type { VaultIndexer } from './vaultIndexer'

type TaskWriterOptions = {
  app: App
  index: TaskIndex
  indexer: VaultIndexer
  getSettings: () => Settings
  // Tells which notes are daily notes, for the tasks the writer returns.
  getQueryContext: () => Promise<TaskQueryContext>
}

const taskChangedMessage = 'This task changed in the note. The list now shows the latest version.'

// The table's own edits of task lines, newest last, so Mod+Z can put a line
// back exactly as it was, with its dates, and a moved task back into the note
// and the place it came from. Edits that remove or add tasks cannot be undone
// this way and clear the list.
type LineEdit = { notePath: string; line: number; before: string; after: string }
type MoveEdit = {
  // The task with its subtasks and notes as they were in their note, nesting included.
  source: { notePath: string; line: number; lines: string[] }
  // The same lines as they were added to the other note.
  target: { notePath: string; line: number; lines: string[] }
}
type UndoEdit = ({ kind: 'line' } & LineEdit) | ({ kind: 'move' } & MoveEdit)
const maxUndoEdits = 50
const cannotUndoMessage = 'The task changed in its note since, so the last change cannot be undone.'

// Writes task edits back to the Markdown notes, then re-indexes the notes.
export const createTaskWriter = ({ app, index, indexer, getSettings, getQueryContext }: TaskWriterOptions) => {
  const { vault } = app
  const notes = createNoteFiles(app)
  const undoEdits: UndoEdit[] = []

  const pushUndoEdit = (edit: UndoEdit): void => {
    undoEdits.push(edit)
    undoEdits.splice(0, undoEdits.length - maxUndoEdits)
  }

  const rememberEdit = (edit: LineEdit): void => {
    if (edit.before !== edit.after) {
      pushUndoEdit({ kind: 'line', ...edit })
    }
  }

  const forgetEdits = (): void => {
    undoEdits.length = 0
  }

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

  // Runs `edit` on the task's current line and returns the line it ended on,
  // with its text before and after the edit.
  const editTaskLine = async (
    id: string,
    edit: (line: string) => string | null,
  ): Promise<LineEdit> => {
    const { task, file } = findTask(id)

    // `process` reads and writes the note atomically, also while it is open in an editor.
    const located: { line: number | null; before: string; after: string | null } = {
      line: null,
      before: '',
      after: null,
    }
    const content = await vault.process(file, (data) => {
      const line = locateLine(data, task.line, task.raw)
      located.line = line
      if (line === null) {
        return data
      }
      located.before = splitLines(data)[line]
      located.after = edit(located.before)
      return replaceLine(data, line, located.after)
    })

    await indexer.indexContent(file, content)

    if (located.line === null) {
      throw new UserError(taskChangedMessage)
    }

    return { notePath: task.filePath, line: located.line, before: located.before, after: located.after ?? '' }
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

  const getTaskAt = async (notePath: string, line: number): Promise<Task> => {
    const task = index.getTaskAtLine(notePath, line)
    if (!task) {
      throw new UserError('The task was saved, but it could not be read back from the note.')
    }
    return toPublicTask(task, await getQueryContext())
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
      forgetEdits()
      const targetAfter = await vault.process(inserted.file, (data) =>
        splitLines(data).slice(inserted.line, inserted.line + movedLines.length).join('\n') === movedLines.join('\n')
          ? removeLines(data, inserted.line, inserted.line + movedLines.length)
          : data,
      )
      await indexer.indexContent(inserted.file, targetAfter)
      await indexer.indexContent(source, sourceAfter)
      throw new UserError(taskChangedMessage)
    }

    pushUndoEdit({
      kind: 'move',
      source: {
        notePath: task.filePath,
        line: block.start,
        lines: splitLines(sourceContent).slice(block.start, block.end),
      },
      target: { notePath: target.notePath, line: inserted.line, lines: movedLines },
    })
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

      const lineEdit = await editTaskLine(id, edit)
      rememberEdit(lineEdit)
      return getTaskAt(lineEdit.notePath, lineEdit.line)
    })

  // Moves the task, with its subtasks and notes, to today's daily note as it is.
  // A task that is in that note already stays where it is.
  const moveTaskToToday = (id: string): Promise<Task> =>
    indexer.runExclusive(async () => {
      const { task } = findTask(id)
      const target = await notes.getDailyNote(new Date())

      if (target.notePath === task.filePath) {
        return toPublicTask(task, await getQueryContext())
      }
      return moveTask(task, target, (line) => line)
    })

  // The comment gets the current local time. The task keeps its id.
  const addComment = ({ id, text }: AddTaskCommentInput): Promise<Task> =>
    indexer.runExclusive(async () => {
      const time = toLocalDateTime(new Date())
      const lineEdit = await editTaskLine(id, (taskLine) => addTaskComment(taskLine, { time, text }))
      rememberEdit(lineEdit)
      return getTaskAt(lineEdit.notePath, lineEdit.line)
    })

  const editComment = ({ id, ...changes }: EditTaskCommentInput): Promise<Task> =>
    indexer.runExclusive(async () => {
      const lineEdit = await editTaskLine(id, (taskLine) => editTaskComment(taskLine, changes))
      rememberEdit(lineEdit)
      return getTaskAt(lineEdit.notePath, lineEdit.line)
    })

  const deleteTask = (id: string): Promise<void> =>
    indexer.runExclusive(async () => {
      await editTaskLine(id, () => null)
      forgetEdits()
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
      forgetEdits()

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
      forgetEdits()

      await indexer.indexContent(inserted.file, inserted.content)
      return getTaskAt(target.notePath, inserted.line)
    })

  // Puts the line of an edit back as it was. A line that changed in its note
  // since is left as it is.
  const undoLineEdit = async (edit: LineEdit): Promise<Task> => {
    const file = notes.getNote(edit.notePath)
    const located: { line: number | null } = { line: null }
    const content = file
      ? await vault.process(file, (data) => {
          located.line = locateLine(data, edit.line, edit.after)
          return located.line === null ? data : replaceLine(data, located.line, edit.before)
        })
      : null

    if (!file || content === null || located.line === null) {
      forgetEdits()
      throw new UserError(cannotUndoMessage)
    }

    await indexer.indexContent(file, content)
    return getTaskAt(edit.notePath, located.line)
  }

  // Puts a moved task back into its note, where it was, as it was there, and
  // only then removes it from the note it was moved to, so it is never lost.
  // A task that changed in either note since stays where it is.
  const undoMoveEdit = async ({ source, target }: MoveEdit): Promise<Task> => {
    const sourceFile = notes.getNote(source.notePath)
    const targetFile = notes.getNote(target.notePath)
    const targetContent = targetFile ? await vault.read(targetFile) : null
    const movedLine = targetContent === null ? null : locateLines(targetContent, target.line, target.lines)

    if (!sourceFile || !targetFile || movedLine === null) {
      forgetEdits()
      throw new UserError(cannotUndoMessage)
    }

    const sourceAfter = await vault.process(sourceFile, (data) => insertLinesAt(data, source.line, source.lines))
    // The lines were added at the source line, or at the end of a note that got shorter.
    const restoredLine = locateLines(sourceAfter, source.line, source.lines) ?? source.line
    let removed = false
    const targetAfter = await vault.process(targetFile, (data) => {
      const line = locateLines(data, movedLine, target.lines)
      if (line === null) {
        return data
      }
      removed = true
      return removeLines(data, line, line + target.lines.length)
    })

    if (!removed) {
      const sourceReverted = await vault.process(sourceFile, (data) => {
        const line = locateLines(data, restoredLine, source.lines)
        return line === null ? data : removeLines(data, line, line + source.lines.length)
      })
      await indexer.indexContent(sourceFile, sourceReverted)
      await indexer.indexContent(targetFile, targetAfter)
      forgetEdits()
      throw new UserError(cannotUndoMessage)
    }

    await indexer.indexContent(targetFile, targetAfter)
    await indexer.indexContent(sourceFile, sourceAfter)
    return getTaskAt(source.notePath, restoredLine)
  }

  // Undoes the newest edit: puts a line back as it was, or a moved task back
  // into its note. Returns null when there is nothing to undo.
  const undoLastEdit = (): Promise<Task | null> =>
    indexer.runExclusive(async () => {
      const edit = undoEdits.pop()
      if (!edit) {
        return null
      }
      return edit.kind === 'move' ? undoMoveEdit(edit) : undoLineEdit(edit)
    })

  return { updateTask, moveTaskToToday, addComment, editComment, deleteTask, cutTask, createTask, undoLastEdit }
}

export type TaskWriter = ReturnType<typeof createTaskWriter>
