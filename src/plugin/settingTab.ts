import {
  FileSystemAdapter,
  Notice,
  Platform,
  PluginSettingTab,
  type App,
  type Plugin,
  type SettingDefinitionItem,
} from 'obsidian'
import { defaultSettings, fullPathMessage, isFullPath, settingNames, type SettingName } from '@shared/settingsTypes'
import { UserError } from '@shared/userError'
import { describeSyncStatus } from '@/logic/syncStatusLogic'
import type { PluginServices } from './pluginServices'

const isSettingName = (key: string): key is SettingName => (settingNames as string[]).includes(key)

// Obsidian's declarative settings: Obsidian renders the rows and includes them
// in settings search. The values live in the plugin's SQLite `settings` table.
export class TasksTableSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    plugin: Plugin,
    private readonly services: PluginServices,
  ) {
    super(app, plugin)
  }

  getControlValue(key: string): unknown {
    if (!isSettingName(key)) {
      return undefined
    }
    return (this.services.getSettings() ?? defaultSettings)[key]
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    if (!isSettingName(key)) {
      return
    }
    try {
      // `invoke` validates the value against the setting's schema.
      await this.services.invoke('settings:update', { [key]: value })
    } catch (error) {
      new Notice(error instanceof UserError ? error.message : 'The setting could not be saved.')
    }
    // The note path row shows only for "A specific note".
    if (key === 'newTaskTarget') {
      this.update()
    }
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const isNoteTarget = () => this.getControlValue('newTaskTarget') === 'note'
    const { adapter } = this.app.vault
    const vaultFolder = adapter instanceof FileSystemAdapter ? adapter.getBasePath() : ''

    return [
      {
        type: 'group',
        items: [
          {
            name: 'Task index',
            aliases: ['rebuild', 'reindex'],
            render: (setting) => {
              const describe = () => {
                void this.services.invoke('vault:status', null).then((status) => {
                  setting.setDesc(describeSyncStatus(status))
                })
              }
              setting.addButton((button) =>
                button.setButtonText('Rebuild index').onClick(async () => {
                  button.setDisabled(true)
                  await this.services.reindex()
                  button.setDisabled(false)
                }),
              )
              describe()
              return this.services.onEvent((event) => {
                if (event.type === 'sync-status') {
                  setting.setDesc(describeSyncStatus(event.status))
                }
              })
            },
          },
        ],
      },
      {
        type: 'group',
        heading: 'New tasks',
        items: [
          {
            name: 'Add new tasks to',
            desc: 'Uses the folder, name format and template of your daily notes.',
            control: {
              type: 'dropdown',
              key: 'newTaskTarget',
              options: { dailyNote: "Today's daily note", note: 'A specific note' },
            },
          },
          {
            name: 'Note',
            desc: 'Path inside the vault. The note is created when it does not exist.',
            visible: isNoteTarget,
            control: {
              type: 'text',
              key: 'newTaskNotePath',
              placeholder: 'Inbox.md',
              validate: (value) => (value.trim() === '' ? 'Enter the path of a note.' : undefined),
            },
          },
          {
            name: 'Under heading',
            desc: 'Adds the task at the end of this section. Leave empty to add it at the end of the note.',
            control: { type: 'text', key: 'newTaskHeading', placeholder: 'End of note' },
          },
        ],
      },
      {
        type: 'group',
        heading: 'Task format',
        items: [
          {
            name: 'Write dates and priority as',
            desc: 'Existing values keep their format.',
            aliases: ['emoji', 'dataview'],
            control: {
              type: 'dropdown',
              key: 'taskFormat',
              options: { emoji: 'Tasks emoji: 📅 2026-11-02', dataview: 'Dataview: [due:: 2026-11-02]' },
            },
          },
          {
            name: 'Add completion dates',
            desc: 'Adds the date when you complete or cancel a task.',
            control: { type: 'toggle', key: 'setDoneDate' },
          },
          {
            name: 'Add created dates',
            desc: 'Adds the date to tasks that you create from the table.',
            control: { type: 'toggle', key: 'setCreatedDate' },
          },
        ],
      },
      {
        type: 'group',
        heading: 'Start date',
        items: [
          {
            name: 'Move tasks to the daily note of their start date',
            desc: 'When you change a start date in the table, the task and its subtasks move to that day’s daily note, under the heading above. The note is created when it does not exist.',
            aliases: ['daily note', 'move'],
            control: { type: 'toggle', key: 'moveToStartDateNote' },
          },
        ],
      },
      {
        type: 'group',
        heading: 'ChatGPT and Claude',
        items: [
          {
            name: 'Folder for new chats',
            desc: '“Run ChatGPT Desktop” and “Run Claude Desktop” in a task’s menu open a new chat in this folder, with the task and its note in the message. Leave empty to use the vault folder.',
            aliases: ['chatgpt', 'claude', 'codex', 'ai'],
            visible: () => Platform.isDesktopApp,
            control: {
              type: 'text',
              key: 'chatFolder',
              placeholder: vaultFolder,
              validate: (value) => (value.trim() === '' || isFullPath(value.trim()) ? undefined : fullPathMessage),
            },
          },
        ],
      },
    ]
  }
}
