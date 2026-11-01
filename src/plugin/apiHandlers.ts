import { z } from 'zod'
import { openTargets, type ApiChannel, type ApiHandlers, type ApiInput } from '@shared/apiContract'
import { settingsPatchSchema } from '@shared/settingsTypes'
import {
  createTaskInputSchema,
  taskListQuerySchema,
  taskOptionsInputSchema,
  updateTaskInputSchema,
} from '@shared/taskTypes'
import { UserError } from '@shared/userError'
import { createViewInputSchema, updateViewInputSchema } from '@shared/viewTypes'

const idSchema = z.string().min(1).max(200)
const idInputSchema = z.object({ id: idSchema })
const emptyInputSchema = z.null()

const inputSchemas: { [Channel in ApiChannel]: z.ZodType<ApiInput<Channel>> } = {
  'tasks:list': taskListQuerySchema,
  'tasks:create': createTaskInputSchema,
  'tasks:update': updateTaskInputSchema,
  'tasks:delete': idInputSchema,
  'tasks:cut': idInputSchema,
  'tasks:options': taskOptionsInputSchema,
  'tasks:fields': emptyInputSchema,
  'tasks:open': z.object({ id: idSchema, target: z.enum(openTargets) }),
  'tasks:openLink': z.object({ id: idSchema, link: z.string().min(1).max(2000), target: z.enum(openTargets) }),
  'views:list': emptyInputSchema,
  'views:create': createViewInputSchema,
  'views:update': updateViewInputSchema,
  'views:delete': idInputSchema,
  'settings:get': emptyInputSchema,
  'settings:update': settingsPatchSchema,
  'vault:reindex': emptyInputSchema,
  'vault:status': emptyInputSchema,
  'app:openSettings': emptyInputSchema,
}

// Validates the input, then runs the handler. Invalid input becomes a UserError.
export const runHandler = async <Channel extends ApiChannel>(
  handlers: ApiHandlers,
  channel: Channel,
  rawInput: unknown,
): Promise<unknown> => {
  const result = inputSchemas[channel].safeParse(rawInput ?? null)

  if (!result.success) {
    throw new UserError(`Some values are not valid: ${result.error.issues[0]?.message ?? ''}`)
  }

  const handler = handlers[channel] as (input: ApiInput<Channel>) => unknown
  return handler(result.data)
}
