import { useState, type SubmitEvent } from 'react'
import { CornerDownLeftIcon, PlusIcon } from 'lucide-react'
import { useSelector } from '@tanstack/react-store'
import type { Settings } from '@shared/settingsTypes'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Kbd } from '@/components/ui/kbd'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getPluginApi } from '@/lib/api'
import { newTaskStore, setNewTaskOpen } from '@/logic/newTaskLogic'
import { createTask } from '@/logic/taskActions'
import { ToolbarLabel } from './ToolbarLabel'
import { toolbarButtonClassName } from './toolbarButtonClassName'

const getTargetLabel = (settings: Settings): string =>
  settings.newTaskTarget === 'dailyNote'
    ? "today's daily note"
    : (settings.newTaskNotePath.split('/').pop() ?? settings.newTaskNotePath).replace(/\.md$/iu, '')

// "New" opens a quick-add field. It stays open after Enter, so several tasks go in one after another.
export const NewTaskButton = ({ settings }: { settings: Settings }) => {
  const open = useSelector(newTaskStore, (state) => state.open)
  const [description, setDescription] = useState('')
  const shortcut = getPluginApi().isMac ? '⌘N' : 'Ctrl+N'

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const text = description.trim()
    if (text === '') {
      return
    }
    setDescription('')
    const created = await createTask({ description: text })
    if (!created) {
      setDescription(text)
    }
  }

  return (
    <Popover open={open} onOpenChange={setNewTaskOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={<Button variant='ghost' size='sm' className={toolbarButtonClassName} />}
            />
          }
        >
          <PlusIcon data-icon='inline-start' />
          <ToolbarLabel>New</ToolbarLabel>
        </TooltipTrigger>
        <TooltipContent>
          New task <Kbd>{shortcut}</Kbd>
        </TooltipContent>
      </Tooltip>
      <PopoverContent align='end' className='w-96 max-w-[calc(100vw-2rem)] p-1.5'>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <InputGroup className='h-8 border-0 shadow-none has-[[data-slot=input-group-control]:focus-visible]:ring-0 dark:bg-transparent'>
            <InputGroupAddon>
              <PlusIcon />
            </InputGroupAddon>
            <InputGroupInput
              aria-label='New task'
              autoComplete='off'
              autoFocus
              placeholder={`Add a task to ${getTargetLabel(settings)}`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <InputGroupAddon align='inline-end'>
              <Kbd>
                <CornerDownLeftIcon aria-hidden='true' />
                <span className='sr-only'>Enter</span>
              </Kbd>
            </InputGroupAddon>
          </InputGroup>
        </form>
      </PopoverContent>
    </Popover>
  )
}
