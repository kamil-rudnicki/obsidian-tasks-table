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
  const pressingRef = useRef(false)

  // Whether a pointer is down anywhere in the window, so a blur can tell a
  // press elsewhere from a Tab.
  useEffect(() => {
    const view = inputRef.current?.ownerDocument.defaultView
    if (!open || !view) {
      return
    }
    const press = () => {
      pressingRef.current = true
    }
    const release = () => {
      pressingRef.current = false
    }
    view.addEventListener('pointerdown', press, true)
    view.addEventListener('pointerup', release, true)
    view.addEventListener('pointercancel', release, true)
    return () => {
      view.removeEventListener('pointerdown', press, true)
      view.removeEventListener('pointerup', release, true)
      view.removeEventListener('pointercancel', release, true)
    }
  }, [open])

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

  // The field may have its focus or text back by now.
  const closeIfLeftEmpty = () => {
    const input = inputRef.current
    if (tasksViewStore.state.search === '' && input?.ownerDocument.activeElement !== input) {
      setSearchOpen(false)
    }
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
        onBlur={(event) => {
          if (search !== '') {
            return
          }
          // A press on a toolbar button, such as Group, takes the focus while the
          // button is still down. Closing the field then would move that button
          // from under the pointer and lose the click, so the field closes once
          // the press is over and the click is done.
          const view = event.currentTarget.ownerDocument.defaultView ?? window
          if (pressingRef.current) {
            view.addEventListener(
              'pointerup',
              () => view.setTimeout(closeIfLeftEmpty, 0),
              { once: true, capture: true },
            )
          } else {
            closeIfLeftEmpty()
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
