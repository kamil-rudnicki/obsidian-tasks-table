import { z } from 'zod'
import { taskFilterSchema, taskSortSchema } from '@shared/taskTypes'

const columnIdSchema = z.string().min(1).max(100)

export const viewConfigSchema = z.object({
  filters: z.array(taskFilterSchema).max(30),
  sorting: z.array(taskSortSchema).max(10),
  columnVisibility: z.record(columnIdSchema, z.boolean()),
  // Built-in columns plus one per inline field the vault uses.
  columnOrder: z.array(columnIdSchema).max(500),
  columnSizing: z.record(columnIdSchema, z.number().positive().max(4000)),
})
export type ViewConfig = z.infer<typeof viewConfigSchema>

export const viewNameSchema = z.string().trim().min(1).max(80)

export type View = {
  id: string
  name: string
  position: number
  config: ViewConfig
  createdAt: string
  updatedAt: string
}

export const createViewInputSchema = z.object({
  name: viewNameSchema,
  config: viewConfigSchema,
})
export type CreateViewInput = z.infer<typeof createViewInputSchema>

export const updateViewInputSchema = z.object({
  id: z.string().min(1).max(200),
  name: viewNameSchema.optional(),
  config: viewConfigSchema.optional(),
})
export type UpdateViewInput = z.infer<typeof updateViewInputSchema>
