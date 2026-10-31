import { ChevronsUpDownIcon, CopyIcon, PencilIcon, PlusIcon, Table2Icon, Trash2Icon } from 'lucide-react'
import type { View } from '@shared/viewTypes'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { deleteView, selectView } from '@/logic/viewActions'
import { openViewDialog } from '@/logic/viewDialogLogic'

type ViewSwitcherProps = {
  views: View[]
  activeView: View
}

// The current view's name; the menu switches, adds, renames and deletes views, as in Bases.
export const ViewSwitcher = ({ views, activeView }: ViewSwitcherProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={<Button variant='ghost' size='sm' className='min-w-0 font-medium' />}
    >
      <Table2Icon data-icon='inline-start' className='text-muted-foreground' />
      <span className='truncate'>{activeView.name}</span>
      <ChevronsUpDownIcon data-icon='inline-end' className='text-muted-foreground' />
    </DropdownMenuTrigger>
    <DropdownMenuContent align='start' className='w-56'>
      <DropdownMenuGroup>
        <DropdownMenuRadioGroup value={activeView.id} onValueChange={(viewId) => selectView(String(viewId))}>
          {views.map((view) => (
            <DropdownMenuRadioItem key={view.id} value={view.id} closeOnClick>
              <Table2Icon />
              <span className='truncate'>{view.name}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem onClick={() => openViewDialog('create', activeView)}>
          <PlusIcon />
          New view…
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openViewDialog('rename', activeView)}>
          <PencilIcon />
          Rename view…
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openViewDialog('duplicate', activeView)}>
          <CopyIcon />
          Duplicate view…
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant='destructive'
          disabled={views.length <= 1}
          onClick={() => void deleteView(activeView)}
        >
          <Trash2Icon />
          Delete view
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
)
