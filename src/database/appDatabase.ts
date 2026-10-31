import { runMigrations } from './migrations'
import { openSqlDatabase, type SqlDatabase } from './sqlite'

// Where the database file lives. The plugin keeps it in its own folder, so it
// syncs with the vault like the plugin's other settings.
export type DatabaseStorage = {
  read: () => Promise<Uint8Array | null>
  write: (bytes: Uint8Array) => Promise<void>
}

const saveDelayMs = 500

// The settings and views database. sql.js keeps it in memory; every change
// is written back to the file shortly after, and at once on `flush()`.
export class AppDatabase {
  private saveTimer: number | null = null
  private saving: Promise<void> = Promise.resolve()
  private dirty = false

  private constructor(
    readonly sql: SqlDatabase,
    private readonly storage: DatabaseStorage,
  ) {}

  static async open(storage: DatabaseStorage): Promise<AppDatabase> {
    const sql = await openSqlDatabase(await storage.read())
    const database = new AppDatabase(sql, storage)

    if (runMigrations(sql).length > 0) {
      database.markChanged()
    }

    return database
  }

  // Call after every write to the database.
  markChanged(): void {
    this.dirty = true
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer)
    }
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null
      void this.flush()
    }, saveDelayMs)
  }

  flush(): Promise<void> {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer)
      this.saveTimer = null
    }

    this.saving = this.saving.then(async () => {
      if (!this.dirty) {
        return
      }
      this.dirty = false
      try {
        await this.storage.write(this.sql.export())
      } catch (error) {
        this.dirty = true
        console.error('Tasks table: could not save the database', error)
      }
    })

    return this.saving
  }

  async close(): Promise<void> {
    await this.flush()
    this.sql.close()
  }
}
