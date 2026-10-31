import { createDefaultViewConfig, defaultViews } from '@shared/taskColumns'
import { UserError } from '@shared/userError'
import {
  viewConfigSchema,
  type CreateViewInput,
  type UpdateViewInput,
  type View,
  type ViewConfig,
} from '@shared/viewTypes'
import type { AppDatabase } from './appDatabase'

type ViewRow = {
  id: string
  name: string
  position: number
  config: string
  created_at: string
  updated_at: string
}

const parseConfig = (config: string): ViewConfig => {
  try {
    const result = viewConfigSchema.safeParse(JSON.parse(config))
    return result.success ? result.data : createDefaultViewConfig()
  } catch {
    return createDefaultViewConfig()
  }
}

const toView = (row: ViewRow): View => ({
  id: row.id,
  name: row.name,
  position: row.position,
  config: parseConfig(row.config),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const createViewsRepository = (database: AppDatabase) => {
  const { sql } = database

  const getCount = (): number =>
    sql.get<{ count: number }>('select count(*) as count from views')?.count ?? 0

  const getView = (id: string): View => {
    const row = sql.get<ViewRow>('select * from views where id = ?', [id])

    if (!row) {
      throw new UserError('This view no longer exists.')
    }

    return toView(row)
  }

  const listViews = (): View[] =>
    sql.all<ViewRow>('select * from views order by position, created_at').map(toView)

  const insertView = ({ name, config }: CreateViewInput): View => {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const position =
      sql.get<{ position: number }>('select coalesce(max(position), -1) + 1 as position from views')
        ?.position ?? 0

    sql.run(
      `insert into views (id, name, position, config, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?)`,
      [id, name, position, JSON.stringify(config), now, now],
    )

    return getView(id)
  }

  const createView = (input: CreateViewInput): View => {
    const view = insertView(input)
    database.markChanged()
    return view
  }

  const updateView = ({ id, name, config }: UpdateViewInput): View => {
    const view = getView(id)

    sql.run('update views set name = ?, config = ?, updated_at = ? where id = ?', [
      name ?? view.name,
      JSON.stringify(config ?? view.config),
      new Date().toISOString(),
      id,
    ])
    database.markChanged()

    return getView(id)
  }

  const deleteView = (id: string): void => {
    sql.transaction(() => {
      getView(id)

      if (getCount() <= 1) {
        throw new UserError('Keep at least one view.')
      }

      sql.run('delete from views where id = ?', [id])
    })
    database.markChanged()
  }

  const seedDefaultViews = (): void => {
    if (getCount() > 0) {
      return
    }

    sql.transaction(() => {
      defaultViews.forEach(insertView)
    })
    database.markChanged()
  }

  return { listViews, createView, updateView, deleteView, seedDefaultViews }
}

export type ViewsRepository = ReturnType<typeof createViewsRepository>
