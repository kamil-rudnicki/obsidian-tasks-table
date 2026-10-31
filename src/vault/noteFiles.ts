import { normalizePath, TFile, type App } from 'obsidian'
import { getDailyNotePath, getTemplatePath, renderTemplate } from './dailyNotes'
import { insertTaskLines } from './noteEdits'
import { formatDate, readDailyNotesConfig } from './vaultConfig'

// A note to add tasks to, and the content it starts with when it does not exist yet.
export type TargetNote = {
  notePath: string
  template: string
}

export type InsertedLines = {
  file: TFile
  content: string
  // Index of the first added line.
  line: number
}

export const normalizeNotePath = (notePath: string): string => {
  const trimmed = normalizePath(notePath.trim()).replace(/^\/+/u, '')
  return /\.md$/iu.test(trimmed) ? trimmed : `${trimmed}.md`
}

const getFolderPath = (filePath: string): string => {
  const separator = filePath.lastIndexOf('/')
  return separator === -1 ? '' : filePath.slice(0, separator)
}

// Finds notes, and creates daily notes the way the Daily notes core plugin does.
export const createNoteFiles = (app: App) => {
  const { vault } = app

  const getNote = (notePath: string): TFile | null => {
    const file = vault.getAbstractFileByPath(notePath)
    return file instanceof TFile ? file : null
  }

  // The daily note of `date`, with the Daily notes template filled for that day.
  const getDailyNote = async (date: Date): Promise<TargetNote> => {
    const config = await readDailyNotesConfig(app)
    const notePath = normalizePath(getDailyNotePath(config, date, formatDate))
    const templateFile = config.template === null ? null : getNote(normalizePath(getTemplatePath(config.template)))
    const template = templateFile ? await vault.read(templateFile) : ''
    const title = notePath.slice(notePath.lastIndexOf('/') + 1).replace(/\.md$/iu, '')

    return { notePath, template: renderTemplate(template, title, date, formatDate) }
  }

  const ensureFolder = async (folderPath: string): Promise<void> => {
    if (folderPath === '' || vault.getAbstractFileByPath(folderPath)) {
      return
    }
    await ensureFolder(getFolderPath(folderPath))
    await vault.createFolder(folderPath)
  }

  // Adds the lines under `heading`, creating the note from its template when it does not exist.
  const insertIntoNote = async (
    { notePath, template }: TargetNote,
    lines: string[],
    heading: string,
  ): Promise<InsertedLines> => {
    const existing = getNote(notePath)

    if (existing) {
      let line = 0
      const content = await vault.process(existing, (data) => {
        const inserted = insertTaskLines(data, lines, heading)
        line = inserted.line
        return inserted.content
      })
      return { file: existing, content, line }
    }

    const inserted = insertTaskLines(template, lines, heading)
    await ensureFolder(getFolderPath(notePath))
    const file = await vault.create(notePath, inserted.content)
    return { file, content: inserted.content, line: inserted.line }
  }

  return { getNote, getDailyNote, insertIntoNote }
}

export type NoteFiles = ReturnType<typeof createNoteFiles>
