import { EllipsisIcon, RefreshCwIcon, Settings2Icon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { syncStatusQueryOptions } from '@/lib/queries'
import { openSettings, reindexVault } from '@/logic/settingsActions'
import { describeSyncStatus } from '@/logic/syncStatusLogic'
import { toolbarButtonClassName } from './toolbarButtonClassName'

export const MoreMenu = () => {
  const { data: status } = useQuery(syncStatusQueryOptions)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant='ghost' size='icon-sm' aria-label='More options' className={toolbarButtonClassName} />}
      >
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-64'>
        {status ? (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel className='font-normal text-pretty tabular-nums'>
                {describeSyncStatus(status)}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuGroup>
          <DropdownMenuItem disabled={status?.state === 'indexing'} onClick={() => void reindexVault()}>
            <RefreshCwIcon />
            Rebuild task index
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void openSettings()}>
            <Settings2Icon />
            Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
