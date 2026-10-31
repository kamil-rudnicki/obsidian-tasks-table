import { useState } from 'react'
import { SearchIcon, XIcon } from 'lucide-react'
import { useSelector } from '@tanstack/react-store'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { setSearch, tasksViewStore } from '@/logic/viewStateLogic'
import { ToolbarLabel } from './ToolbarLabel'
import { toolbarButtonClassName } from './toolbarButtonClassName'

// A "Search" button that turns into a field, as in Bases. It stays open while it holds text.
export const SearchToggle = () => {
  const search = useSelector(tasksViewStore, (state) => state.search)
  const [open, setOpen] = useState(false)

  if (!open && search === '') {
    return (
      <Button
        variant='ghost'
        size='sm'
        className={toolbarButtonClassName}
        onClick={() => setOpen(true)}
      >
        <SearchIcon data-icon='inline-start' />
        <ToolbarLabel>Search</ToolbarLabel>
      </Button>
    )
  }

  const close = () => {
    setSearch('')
    setOpen(false)
  }

  return (
    <InputGroup className='h-7 w-40 @3xl/tasks:w-52'>
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        type='text'
        inputMode='search'
        aria-label='Search tasks'
        placeholder='Search tasks'
        autoFocus
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onBlur={() => {
          if (search === '') {
            setOpen(false)
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            close()
          }
        }}
      />
      <InputGroupAddon align='inline-end'>
        <InputGroupButton size='icon-xs' aria-label='Clear search' onClick={close}>
          <XIcon />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
