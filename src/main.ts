import { Platform, Plugin } from 'obsidian'
import { setPluginApi } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import { subscribeToAppEvents } from '@/logic/appEvents'
import { flushViewSaves, restoreActiveView } from '@/logic/viewActions'
import { PluginServices } from './plugin/pluginServices'
import { TasksTableSettingTab } from './plugin/settingTab'
import { TasksTableView, tasksTableViewType } from './plugin/tasksTableView'

export default class TasksTablePlugin extends Plugin {
  private services!: PluginServices

  onload(): void {
    const services = new PluginServices(this)
    this.services = services

    setPluginApi({
      invoke: (channel, input) => services.invoke(channel, input),
      onEvent: (listener) => services.onEvent(listener),
      loadUiState: (key) => this.app.loadLocalStorage(key) as unknown,
      saveUiState: (key, value) => this.app.saveLocalStorage(key, value),
      isMac: Platform.isMacOS,
    })
    this.register(subscribeToAppEvents(queryClient))
    restoreActiveView()

    this.registerView(tasksTableViewType, (leaf) => new TasksTableView(leaf, services))
    this.addRibbonIcon('list-checks', 'Open tasks table', () => void this.openTasksTable())
    this.addCommand({
      id: 'open-table',
      name: 'Open table',
      callback: () => void this.openTasksTable(),
    })
    this.addCommand({
      id: 'add-task',
      name: 'Add task',
      callback: () => void this.openTasksTable().then(() => services.emit({ type: 'focus-new-task' })),
    })
    this.addCommand({
      id: 'rebuild-task-index',
      name: 'Rebuild task index',
      callback: () => void services.reindex(),
    })
    this.addSettingTab(new TasksTableSettingTab(this.app, this, services))

    // Indexing reads every note with tasks, so it waits until Obsidian has loaded.
    this.app.workspace.onLayoutReady(() => void services.start())
  }

  onunload(): void {
    const services = this.services
    // Pending view changes are saved before the database closes.
    void flushViewSaves().finally(() => services.stop())
    queryClient.clear()
    setPluginApi(null)
  }

  // Shows the existing table instead of opening a second one.
  private async openTasksTable(): Promise<void> {
    const { workspace } = this.app
    const leaf = workspace.getLeavesOfType(tasksTableViewType)[0] ?? workspace.getLeaf('tab')

    await leaf.setViewState({ type: tasksTableViewType, active: true })
    await workspace.revealLeaf(leaf)
  }
}
