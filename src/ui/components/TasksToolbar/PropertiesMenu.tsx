import { Columns3Icon } from 'lucide-react'
import type { Column } from '@tanstack/react-table'
import { getInlineFieldKey, type Task } from '@shared/taskTypes'
import {
  getColumnHeaderLabel,
  useDataGrid,
  type DataGridFeatures,
} from '@/components/reui/data-grid/data-grid'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ToolbarLabel } from './ToolbarLabel'
import { toolbarButtonClassName } from './toolbarButtonClassName'

type TaskColumn = Column<DataGridFeatures, Task, unknown>

const PropertyItem = ({ column }: { column: TaskColumn }) => (
  <DropdownMenuCheckboxItem
    checked={column.getIsVisible()}
    onCheckedChange={(visible) => column.toggleVisibility(visible)}
  >
    {getColumnHeaderLabel(column)}
  </DropdownMenuCheckboxItem>
)

// Shows and hides columns: the built-in properties first, then the vault's
// Dataview inline fields, by how often tasks use them.
export const PropertiesMenu = () => {
  const { table } = useDataGrid()
  const columns = (table.getAllLeafColumns() as TaskColumn[]).filter((column) => column.getCanHide())
  const builtIn = columns.filter((column) => getInlineFieldKey(column.id) === null)
  const fields = columns.filter((column) => getInlineFieldKey(column.id) !== null)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant='ghost' size='sm' className={toolbarButtonClassName} />}
      >
        <Columns3Icon data-icon='inline-start' />
        <ToolbarLabel>Properties</ToolbarLabel>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='min-w-40'>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Properties</DropdownMenuLabel>
          {builtIn.map((column) => (
            <PropertyItem key={column.id} column={column} />
          ))}
        </DropdownMenuGroup>
        {fields.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Dataview</DropdownMenuLabel>
              {fields.map((column) => (
                <PropertyItem key={column.id} column={column} />
              ))}
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
