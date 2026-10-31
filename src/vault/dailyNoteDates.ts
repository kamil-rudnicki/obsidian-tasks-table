import type { App } from 'obsidian'
import { getDailyNoteDate, type DailyNotesConfig } from './dailyNotes'
import type { TaskQueryContext } from './taskQuery'
import { parseDate, readDailyNotesConfig } from './vaultConfig'

// The Daily notes settings can change at any time, but reading them on every
// keystroke in the search box is not needed.
const configMaxAgeMs = 5000

// Knows which notes are daily notes, and of which day, for the "Daily note" filter.
export class DailyNoteDates {
  private config: DailyNotesConfig | null = null
  private readAt = 0
  private readonly dates = new Map<string, string | null>()

  constructor(private readonly app: App) {}

  async getQueryContext(): Promise<TaskQueryContext> {
    const config = await this.getConfig()
    return {
      getDailyNoteDate: (filePath) => {
        if (!this.dates.has(filePath)) {
          this.dates.set(filePath, getDailyNoteDate(config, filePath, parseDate))
        }
        return this.dates.get(filePath) ?? null
      },
    }
  }

  private async getConfig(): Promise<DailyNotesConfig> {
    if (this.config !== null && Date.now() - this.readAt <= configMaxAgeMs) {
      return this.config
    }

    const config = await readDailyNotesConfig(this.app)
    if (JSON.stringify(config) !== JSON.stringify(this.config)) {
      this.dates.clear()
    }
    this.config = config
    this.readAt = Date.now()
    return config
  }
}
