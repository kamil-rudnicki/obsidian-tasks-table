import { ItemView, Scope, type WorkspaceLeaf } from 'obsidian'
import { mountTasksApp } from '@/mountTasksApp'
import type { PluginServices } from './pluginServices'

export const tasksTableViewType = 'tasks-table'

// A full-page view with every task of the vault in one table.
export class TasksTableView extends ItemView {
  private unmount: (() => void) | null = null

  constructor(
    leaf: WorkspaceLeaf,
    private readonly services: PluginServices,
  ) {
    super(leaf)
    this.navigation = false
    // Mod+N adds a task while the table has focus, instead of creating a note.
    this.scope = new Scope(this.app.scope)
    this.scope.register(['Mod'], 'n', () => {
      this.services.emit({ type: 'focus-new-task' })
      return false
    })
  }

  getViewType(): string {
    return tasksTableViewType
  }

  getDisplayText(): string {
    return 'Tasks'
  }

  getIcon(): string {
    return 'list-checks'
  }

  onOpen(): Promise<void> {
    this.contentEl.empty()
    this.unmount = mountTasksApp(this.contentEl)
    return Promise.resolve()
  }

  onClose(): Promise<void> {
    this.unmount?.()
    this.unmount = null
    return Promise.resolve()
  }
}
