import { MarkdownView, normalizePath, TFile, type App, type Plugin } from 'obsidian'
import type { ApiChannel, ApiHandlers, ApiInput, ApiOutput, OpenTarget } from '@shared/apiContract'
import { getToday } from '@shared/dateLogic'
import type { Settings, SettingsPatch } from '@shared/settingsTypes'
import type { AppEvent } from '@shared/syncTypes'
import { UserError } from '@shared/userError'
import { AppDatabase, type DatabaseStorage } from '../database/appDatabase'
import { createSettingsRepository, type SettingsRepository } from '../database/settingsRepository'
import { createViewsRepository, type ViewsRepository } from '../database/viewsRepository'
import { parseTasksPluginDefaults } from '../vault/dailyNotes'
import { DailyNoteDates } from '../vault/dailyNoteDates'
import { TaskIndex } from '../vault/taskIndex'
import { createTaskWriter, type TaskWriter } from '../vault/taskWriter'
import { readConfigJson } from '../vault/vaultConfig'
import { VaultIndexer } from '../vault/vaultIndexer'
import { runHandler } from './apiHandlers'

export type AppEventListener = (event: AppEvent) => void

const databaseFileName = 'tasks-table.sqlite'
const tasksPluginId = 'obsidian-tasks-plugin'

type Started = {
  database: AppDatabase
  settings: SettingsRepository
  views: ViewsRepository
  writer: TaskWriter
}

// Owns the plugin's data: the SQLite database with settings and views, the
// in-memory task index, and the indexer that keeps it equal to the vault.
// The React UI reaches all of it through `invoke`.
export class PluginServices {
  private readonly listeners = new Set<AppEventListener>()
  private readonly index = new TaskIndex()
  private readonly dailyNoteDates: DailyNoteDates
  private readonly indexer: VaultIndexer
  private readonly started: Promise<Started>
  private resolveStarted!: (started: Started) => void
  private rejectStarted!: (error: unknown) => void
  private tasksChangedTimer: number | null = null
  private current: Started | null = null

  constructor(private readonly plugin: Plugin) {
    this.started = new Promise((resolve, reject) => {
      this.resolveStarted = resolve
      this.rejectStarted = reject
    })
    // The UI shows its own error state; this keeps the rejection from being reported twice.
    this.started.catch(() => undefined)
    this.dailyNoteDates = new DailyNoteDates(plugin.app)
    this.indexer = new VaultIndexer({
      app: plugin.app,
      index: this.index,
      // Many notes can change at once; the UI refetches once per burst.
      onTasksChanged: () => {
        this.tasksChangedTimer ??= window.setTimeout(() => {
          this.tasksChangedTimer = null
          this.emit({ type: 'tasks-changed' })
        }, 50)
      },
      onStatusChanged: (status) => this.emit({ type: 'sync-status', status }),
    })
  }

  async start(): Promise<void> {
    try {
      const database = await AppDatabase.open(this.getDatabaseStorage())
      const settings = createSettingsRepository(database)
      const views = createViewsRepository(database)
      const writer = createTaskWriter({
        app: this.plugin.app,
        index: this.index,
        indexer: this.indexer,
        getSettings: settings.getSettings,
      })

      views.seedDefaultViews()
      this.current = { database, settings, views, writer }
      await this.adoptTasksPluginDefaults(this.current)
      this.resolveStarted(this.current)
    } catch (error) {
      console.error('Tasks table: could not open the database', error)
      this.rejectStarted(error)
      return
    }

    await this.indexer.start()
  }

  async stop(): Promise<void> {
    this.indexer.stop()
    if (this.tasksChangedTimer) {
      window.clearTimeout(this.tasksChangedTimer)
    }
    this.listeners.clear()
    await this.current?.database.close()
    this.current = null
  }

  // Null until the database is open.
  getSettings(): Settings | null {
    return this.current?.settings.getSettings() ?? null
  }

  onEvent(listener: AppEventListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit(event: AppEvent): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }

  async invoke<Channel extends ApiChannel>(
    channel: Channel,
    input: ApiInput<Channel>,
  ): Promise<ApiOutput<Channel>> {
    // The sync status is known before the database opens.
    if (channel === 'vault:status') {
      return this.indexer.getStatus()
    }
    const started = await this.started
    return (await runHandler(this.createHandlers(started), channel, input)) as ApiOutput<Channel>
  }

  reindex(): Promise<void> {
    return this.indexer.scan({ force: true })
  }

  private createHandlers({ settings, views, writer }: Started): ApiHandlers {
    return {
      'tasks:list': async (query) =>
        this.index.listTasks(query, getToday(), await this.dailyNoteDates.getQueryContext()),
      'tasks:create': (input) => writer.createTask(input),
      'tasks:update': (input) => writer.updateTask(input),
      'tasks:delete': async ({ id }) => {
        await writer.deleteTask(id)
        return null
      },
      'tasks:options': (input) => this.index.listOptions(input),
      'tasks:fields': () => this.index.listFields(),
      'tasks:open': async ({ id, target }) => {
        await this.openTask(id, target)
        return null
      },
      'tasks:openLink': async ({ id, link, target }) => {
        const task = this.index.getTask(id)
        if (!task) {
          throw new UserError('This task no longer exists.')
        }
        // Like a link in the note: relative paths and missing notes resolve as Obsidian does.
        await this.plugin.app.workspace.openLinkText(link, task.filePath, target)
        return null
      },
      'views:list': () => views.listViews(),
      // Every React root shares one query cache, so view changes need no event.
      'views:create': (input) => views.createView(input),
      'views:update': (input) => views.updateView(input),
      'views:delete': ({ id }) => {
        views.deleteView(id)
        return null
      },
      'settings:get': () => settings.getSettings(),
      'settings:update': (patch) => {
        const next = settings.updateSettings(patch)
        this.emit({ type: 'settings-changed' })
        return next
      },
      'vault:reindex': async () => {
        await this.reindex()
        return null
      },
      'vault:status': () => this.indexer.getStatus(),
      'app:openSettings': () => {
        this.openSettings()
        return null
      },
    }
  }

  // Obsidian has no public API to open a plugin's settings tab; this is the
  // one other plugins use, and it fails quietly if Obsidian changes it.
  openSettings(): void {
    const { setting } = this.plugin.app as App & {
      setting?: { open?: () => void; openTabById?: (id: string) => void }
    }
    setting?.open?.()
    setting?.openTabById?.(this.plugin.manifest.id)
  }

  private async openTask(id: string, target: OpenTarget): Promise<void> {
    const { workspace, vault } = this.plugin.app
    const task = this.index.getTask(id)
    const file = task ? vault.getAbstractFileByPath(task.filePath) : null

    if (!task || !(file instanceof TFile)) {
      throw new UserError('This task no longer exists.')
    }

    const leaf = workspace.getLeaf(target)
    await leaf.openFile(file, { active: true, eState: { line: task.line } })

    if (leaf.view instanceof MarkdownView) {
      const { editor } = leaf.view
      const end = { line: task.line, ch: editor.getLine(task.line).length }
      editor.setCursor(end)
      editor.scrollIntoView({ from: end, to: end }, true)
    }
  }

  private getDatabaseStorage(): DatabaseStorage {
    const { adapter } = this.plugin.app.vault
    const path = normalizePath(`${this.plugin.manifest.dir ?? ''}/${databaseFileName}`)

    return {
      read: async () => ((await adapter.exists(path)) ? new Uint8Array(await adapter.readBinary(path)) : null),
      write: async (bytes) => {
        await adapter.writeBinary(path, bytes.slice().buffer)
      },
    }
  }

  // On the first start, write tasks the way the Obsidian Tasks plugin does.
  private async adoptTasksPluginDefaults({ settings }: Pick<Started, 'settings'>): Promise<void> {
    if (settings.hasSetting('taskFormat')) {
      return
    }

    const defaults = parseTasksPluginDefaults(
      await readConfigJson(this.plugin.app, `plugins/${tasksPluginId}/data.json`),
    )
    const patch: SettingsPatch = { taskFormat: defaults.taskFormat ?? settings.getSettings().taskFormat }
    if (defaults.setCreatedDate !== null) {
      patch.setCreatedDate = defaults.setCreatedDate
    }
    settings.updateSettings(patch)
  }
}
