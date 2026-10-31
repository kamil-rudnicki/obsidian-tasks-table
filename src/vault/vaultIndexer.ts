import { TFile, TFolder, type App, type CachedMetadata, type EventRef, type TAbstractFile } from 'obsidian'
import type { SyncStatus } from '@shared/syncTypes'
import { parseNoteTasks } from './noteTasks'
import type { NoteState, TaskIndex } from './taskIndex'

type VaultIndexerOptions = {
  app: App
  index: TaskIndex
  onTasksChanged: () => void
  onStatusChanged: (status: SyncStatus) => void
}

// Notes read between two yields to the interface during a scan.
const scanBatchSize = 40
const scanDebounceMs = 400

const isNote = (file: TAbstractFile): file is TFile =>
  file instanceof TFile && file.extension === 'md'

const getNoteState = (file: TFile): NoteState => ({
  path: file.path,
  mtimeMs: file.stat.mtime,
  size: file.stat.size,
})

const isUnchanged = (state: NoteState | undefined, file: TFile): boolean =>
  state !== undefined && state.mtimeMs === file.stat.mtime && state.size === file.stat.size

// Obsidian's metadata cache knows which notes have tasks, so notes without
// tasks are not read at all, as in the Tasks plugin.
const mayHaveTasks = (cache: CachedMetadata | null): boolean =>
  cache === null || (cache.listItems?.some((item) => item.task !== undefined) ?? false)

const yieldToInterface = (): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, 0))

// Keeps the in-memory task index equal to the vault's Markdown notes. Every
// read and write of a note runs through one queue, so the index never sees a
// half-done edit.
export class VaultIndexer {
  private readonly options: VaultIndexerOptions
  private readonly eventRefs: Array<{ off: () => void }> = []
  private queue: Promise<unknown> = Promise.resolve()
  private scanTimer: number | null = null
  private scanRunning = false
  private scanRequested = false
  private stopped = false
  private status: SyncStatus = {
    state: 'starting',
    taskCount: 0,
    noteCount: 0,
    lastIndexedAt: null,
    error: null,
  }

  constructor(options: VaultIndexerOptions) {
    this.options = options
  }

  getStatus(): SyncStatus {
    return this.status
  }

  async start(): Promise<void> {
    const { metadataCache, vault } = this.options.app

    this.listen(metadataCache, metadataCache.on('changed', (file, data) => {
      if (isNote(file)) {
        void this.runExclusive(() => this.indexContent(file, data))
      }
    }))
    this.listen(vault, vault.on('create', (file) => {
      if (isNote(file)) {
        void this.runExclusive(() => this.indexFile(file, { force: true }))
      }
    }))
    this.listen(vault, vault.on('delete', (file) => {
      if (isNote(file)) {
        this.removeNotes([file.path])
      } else if (file instanceof TFolder) {
        this.requestScan()
      }
    }))
    this.listen(vault, vault.on('rename', (file, oldPath) => {
      if (file instanceof TFolder) {
        this.requestScan()
        return
      }
      this.removeNotes([oldPath])
      if (isNote(file)) {
        void this.runExclusive(() => this.indexFile(file, { force: true }))
      }
    }))

    await this.scan()
  }

  stop(): void {
    this.stopped = true
    for (const ref of this.eventRefs) {
      ref.off()
    }
    this.eventRefs.length = 0
    if (this.scanTimer) {
      window.clearTimeout(this.scanTimer)
      this.scanTimer = null
    }
  }

  // Runs note reads and writes one at a time.
  runExclusive<Result>(task: () => Promise<Result>): Promise<Result> {
    const result = this.queue.then(task, task)
    this.queue = result.catch((error: unknown) => {
      console.error('Tasks table: indexing failed', error)
    })
    return result
  }

  // Indexes a note from content the caller already has, for example right
  // after writing it. Call it only from inside `runExclusive`.
  indexContent(file: TFile, content: string): Promise<boolean> {
    const changed = this.options.index.replaceNoteTasks(
      getNoteState(file),
      parseNoteTasks(file.path, content),
    )
    if (changed) {
      this.notifyTasksChanged()
    }
    return Promise.resolve(changed)
  }

  requestScan(): void {
    if (this.stopped || this.scanTimer) {
      return
    }
    this.scanTimer = window.setTimeout(() => {
      this.scanTimer = null
      void this.scan()
    }, scanDebounceMs)
  }

  // `force` re-reads every note, even when its size and modification time match.
  async scan({ force = false }: { force?: boolean } = {}): Promise<void> {
    if (this.scanRunning) {
      this.scanRequested = true
      return
    }

    this.scanRunning = true
    this.setStatus({ state: 'indexing', error: null })

    try {
      const files = this.options.app.vault.getMarkdownFiles()
      const known = this.options.index.getNoteStates()
      let changed = false

      for (let start = 0; start < files.length && !this.stopped; start += scanBatchSize) {
        const batch = files.slice(start, start + scanBatchSize)
        const results = await this.runExclusive(async () => {
          const batchResults: boolean[] = []
          for (const file of batch) {
            const state = known.get(file.path)
            known.delete(file.path)
            if (force || !isUnchanged(state, file)) {
              batchResults.push(await this.readNote(file, { force }))
            }
          }
          return batchResults
        })
        changed = results.includes(true) || changed
        await yieldToInterface()
      }

      if (this.stopped) {
        return
      }

      if (known.size > 0) {
        changed = this.options.index.deleteNotes([...known.keys()]) || changed
      }

      if (changed) {
        this.options.onTasksChanged()
      }

      this.setStatus({ state: 'idle', lastIndexedAt: new Date().toISOString(), error: null })
    } catch (error) {
      console.error('Tasks table: vault scan failed', error)
      this.setStatus({ state: 'error', error: 'The vault could not be read.' })
    } finally {
      this.scanRunning = false
      if (this.scanRequested) {
        this.scanRequested = false
        this.requestScan()
      }
    }
  }

  private listen(source: { offref: (ref: EventRef) => void }, ref: EventRef): void {
    this.eventRefs.push({ off: () => source.offref(ref) })
  }

  private async indexFile(file: TFile, { force }: { force: boolean }): Promise<void> {
    if (await this.readNote(file, { force })) {
      this.notifyTasksChanged()
    }
  }

  // Returns true when the note's tasks changed in the index.
  private async readNote(file: TFile, { force }: { force: boolean }): Promise<boolean> {
    const { metadataCache, vault } = this.options.app

    if (!force && !mayHaveTasks(metadataCache.getFileCache(file))) {
      return this.options.index.replaceNoteTasks(getNoteState(file), [])
    }

    const content = await vault.cachedRead(file)
    return this.options.index.replaceNoteTasks(getNoteState(file), parseNoteTasks(file.path, content))
  }

  private removeNotes(paths: string[]): void {
    if (this.options.index.deleteNotes(paths)) {
      this.notifyTasksChanged()
    }
  }

  private notifyTasksChanged(): void {
    this.options.onTasksChanged()
    if (this.status.state !== 'indexing') {
      this.setStatus({})
    }
  }

  private setStatus(patch: Partial<SyncStatus>): void {
    this.status = {
      ...this.status,
      ...patch,
      ...this.options.index.getCounts(),
    }
    this.options.onStatusChanged(this.status)
  }
}
