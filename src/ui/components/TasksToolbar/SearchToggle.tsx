import { useEffect, useRef } from 'react'
import { SearchIcon, XIcon } from 'lucide-react'
import { useSelector } from '@tanstack/react-store'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { setSearch, setSearchOpen, tasksViewStore } from '@/logic/viewStateLogic'
import { ToolbarLabel } from './ToolbarLabel'
import { toolbarButtonClassName } from './toolbarButtonClassName'

// A "Search" button that turns into a field, as in Bases. It stays open while it
// holds text. Mod+F opens it, or focuses it and selects its text when it is open.
export const SearchToggle = () => {
  const search = useSelector(tasksViewStore, (state) => state.search)
  const open = useSelector(tasksViewStore, (state) => state.searchOpen)
  const focusRequest = useSelector(tasksViewStore, (state) => state.searchFocusRequest)
  const inputRef = useRef<HTMLInputElement>(null)

  // A field that opens takes focus through autoFocus; an open one needs a nudge.
  useEffect(() => {
    if (focusRequest > 0) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [focusRequest])

  if (!open && search === '') {
    return (
      <Button
        variant='ghost'
        size='sm'
        className={toolbarButtonClassName}
        onClick={() => setSearchOpen(true)}
      >
        <SearchIcon data-icon='inline-start' />
        <ToolbarLabel>Search</ToolbarLabel>
      </Button>
    )
  }

  const close = () => {
    setSearch('')
    setSearchOpen(false)
  }

  return (
    <InputGroup className='h-7 w-40 @3xl/tasks:w-52'>
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        ref={inputRef}
        type='text'
        inputMode='search'
        aria-label='Search tasks'
        placeholder='Search tasks'
        autoFocus
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onBlur={() => {
          if (search === '') {
            setSearchOpen(false)
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
