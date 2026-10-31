import { hashString } from '@shared/hash'
import type { SqlDatabase } from './sqlite'

export type Migration = {
  name: string
  sql: string
}

// Each entry runs once, in order. Never edit a migration that has shipped; add a new one.
// Tasks are not stored here: the vault's Markdown notes are their only source.
export const migrations: Migration[] = [
  {
    name: '0001_create_settings_and_views',
    sql: `
      -- One row per general setting. \`value\` holds JSON.
      create table settings (
        name text primary key,
        value text not null
      ) strict;

      -- Saved table views. \`config\` holds the filters, sorting and columns as JSON.
      create table views (
        id text primary key,
        name text not null,
        position integer not null,
        config text not null,
        created_at text not null,
        updated_at text not null
      ) strict;
    `,
  },
]

// Line endings can change on checkout, so they do not count as an edit.
const getChecksum = (sql: string): string => hashString(sql.replace(/\r\n/gu, '\n'))

// Applies each migration once, in order, each in its own transaction.
// Returns the names of the migrations it applied.
export const runMigrations = (database: SqlDatabase, list: Migration[] = migrations): string[] => {
  database.exec(`
    create table if not exists schema_migrations (
      name text primary key,
      checksum text not null,
      applied_at text not null
    ) strict
  `)

  const applied = new Map(
    database
      .all<{ name: string; checksum: string }>('select name, checksum from schema_migrations')
      .map((row) => [row.name, row.checksum]),
  )
  const known = new Set(list.map((migration) => migration.name))
  const unknown = [...applied.keys()].filter((name) => !known.has(name))

  if (unknown.length > 0) {
    throw new Error(
      `The database was updated by a newer version of the plugin (migration ${unknown.join(', ')}). Update the plugin to open it.`,
    )
  }

  const appliedNow: string[] = []

  for (const migration of list) {
    const checksum = getChecksum(migration.sql)
    const appliedChecksum = applied.get(migration.name)

    if (appliedChecksum !== undefined) {
      if (appliedChecksum !== checksum) {
        throw new Error(
          `Migration ${migration.name} changed after it was applied. Add a new migration instead of editing it.`,
        )
      }
      continue
    }

    try {
      database.transaction(() => {
        database.exec(migration.sql)
        database.run('insert into schema_migrations (name, checksum, applied_at) values (?, ?, ?)', [
          migration.name,
          checksum,
          new Date().toISOString(),
        ])
      })
    } catch (error) {
      throw new Error(`Migration ${migration.name} failed: ${(error as Error).message}`, {
        cause: error,
      })
    }
    appliedNow.push(migration.name)
  }

  return appliedNow
}
