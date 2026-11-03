import { ItemView, Scope, type WorkspaceLeaf } from 'obsidian'
import { undoLastChange } from '@/logic/taskActions'
import { mountTasksApp } from '@/mountTasksApp'
import type { PluginServices } from './pluginServices'

export const tasksTableViewType = 'tasks-table'

// Fields where Mod+Z undoes typing, such as the title editor and the search.
const isTextField = (target: EventTarget | null): boolean =>
  target !== null &&
  'closest' in target &&
  (target as Element).closest(
    'input:not([type="checkbox"], [type="radio"], [type="button"]), textarea, select, [contenteditable]:not([contenteditable="false"])',
  ) !== null

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
    // Mod+F searches the tasks; the table has no note to find text in.
    this.scope.register(['Mod'], 'f', () => {
      this.services.emit({ type: 'focus-search' })
      return false
    })
    // Mod+Z undoes the table's last change to a task, once, from this view.
    // In a text field it undoes typing, as everywhere.
    this.scope.register(['Mod'], 'z', (event) => {
      if (isTextField(event.target)) {
        return true
      }
      void undoLastChange()
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
