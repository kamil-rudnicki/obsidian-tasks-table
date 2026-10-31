import { describe, expect, test } from 'vitest'
import { defaultSettings } from '@shared/settingsTypes'
import { AppDatabase, type DatabaseStorage } from './appDatabase'
import { runMigrations, type Migration } from './migrations'
import { createSettingsRepository } from './settingsRepository'
import { openSqlDatabase } from './sqlite'
import { createViewsRepository } from './viewsRepository'

const memoryStorage = (initial: Uint8Array | null = null) => {
  const writes: Uint8Array[] = []
  const storage: DatabaseStorage = {
    read: () => Promise.resolve(initial),
    write: (bytes) => {
      writes.push(bytes)
      return Promise.resolve()
    },
  }
  return { storage, writes }
}

describe('migrations', () => {
  test('apply once and refuse edited or unknown migrations', async () => {
    const sql = await openSqlDatabase(null)
    const first: Migration = { name: '0001_a', sql: 'create table a (id integer) strict;' }

    expect(runMigrations(sql, [first])).toEqual(['0001_a'])
    expect(runMigrations(sql, [first])).toEqual([])
    expect(() => runMigrations(sql, [{ ...first, sql: 'create table b (id integer);' }])).toThrow(
      'changed after it was applied',
    )
    expect(() => runMigrations(sql, [])).toThrow('newer version of the plugin')
  })

  test('roll back a failing migration', async () => {
    const sql = await openSqlDatabase(null)

    expect(() =>
      runMigrations(sql, [{ name: '0001_bad', sql: 'create table a (id integer); select * from missing;' }]),
    ).toThrow('Migration 0001_bad failed')
    expect(sql.all("select name from sqlite_master where name = 'a'")).toEqual([])
  })
})

describe('app database', () => {
  test('saves to storage and opens the saved bytes again', async () => {
    const { storage, writes } = memoryStorage()
    const database = await AppDatabase.open(storage)
    createSettingsRepository(database).updateSettings({ newTaskHeading: 'Tasks' })
    await database.flush()

    expect(writes.length).toBe(1)

    const reopened = await AppDatabase.open(memoryStorage(writes[0]).storage)
    expect(createSettingsRepository(reopened).getSettings().newTaskHeading).toBe('Tasks')
  })
})

describe('settings repository', () => {
  test('stores each setting as one name and value row', async () => {
    const database = await AppDatabase.open(memoryStorage().storage)
    const settings = createSettingsRepository(database)

    expect(settings.getSettings()).toEqual(defaultSettings)
    expect(settings.hasSetting('taskFormat')).toBe(false)
    expect(settings.updateSettings({ taskFormat: 'dataview', newTaskHeading: 'Inbox' })).toMatchObject({
      taskFormat: 'dataview',
      newTaskHeading: 'Inbox',
    })
    expect(settings.hasSetting('taskFormat')).toBe(true)
    expect(database.sql.all('select name, value from settings order by name')).toEqual([
      { name: 'newTaskHeading', value: '"Inbox"' },
      { name: 'taskFormat', value: '"dataview"' },
    ])
  })

  test('falls back to defaults for unknown or invalid rows', async () => {
    const database = await AppDatabase.open(memoryStorage().storage)
    database.sql.exec(
      `insert into settings values ('taskFormat', '"blue"'), ('setDoneDate', 'not json'), ('other', '1')`,
    )

    expect(createSettingsRepository(database).getSettings()).toEqual(defaultSettings)
  })
})

describe('views repository', () => {
  test('seeds default views once and keeps at least one view', async () => {
    const views = createViewsRepository(await AppDatabase.open(memoryStorage().storage))

    views.seedDefaultViews()
    views.seedDefaultViews()
    const seeded = views.listViews()
    expect(seeded.map((view) => view.name)).toEqual(['Open', 'Upcoming', 'Completed', 'All tasks'])

    for (const view of seeded.slice(1)) {
      views.deleteView(view.id)
    }
    expect(() => views.deleteView(seeded[0].id)).toThrow('Keep at least one view.')
  })

  test('creates, renames and reconfigures views', async () => {
    const views = createViewsRepository(await AppDatabase.open(memoryStorage().storage))
    views.seedDefaultViews()
    const [open] = views.listViews()

    const created = views.createView({ name: 'Work', config: open.config })
    expect(created.position).toBe(4)

    const updated = views.updateView({
      id: created.id,
      name: 'Work tasks',
      config: { ...open.config, sorting: [{ id: 'note', desc: true }] },
    })
    expect(updated).toMatchObject({ name: 'Work tasks', config: { sorting: [{ id: 'note', desc: true }] } })
    expect(() => views.updateView({ id: 'missing' })).toThrow('This view no longer exists.')
  })
})
