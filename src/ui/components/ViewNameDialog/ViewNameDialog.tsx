import type { SubmitEvent } from 'react'
import { useSelector } from '@tanstack/react-store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { createView, duplicateView, renameView } from '@/logic/viewActions'
import { closeViewDialog, viewDialogStore, type ViewDialogMode } from '@/logic/viewDialogLogic'

const copy: Record<ViewDialogMode, { title: string; description: (name: string) => string; action: string }> = {
  create: {
    title: 'New view',
    description: () => 'Starts with every task and the default properties.',
    action: 'Create view',
  },
  duplicate: {
    title: 'Duplicate view',
    description: (name) => `Copies the filters, sorting and properties of “${name}”.`,
    action: 'Duplicate view',
  },
  rename: {
    title: 'Rename view',
    description: () => 'The view keeps its filters, sorting and properties.',
    action: 'Rename view',
  },
}

export const ViewNameDialog = () => {
  const { mode, view } = useSelector(viewDialogStore, (state) => state)
  const text = copy[mode ?? 'create']

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const value = new FormData(event.currentTarget).get('name')
    const name = typeof value === 'string' ? value.trim() : ''
    if (!view || name === '') {
      return
    }
    closeViewDialog()
    if (mode === 'rename') {
      await renameView(view, name)
    } else if (mode === 'duplicate') {
      await duplicateView(view, name)
    } else {
      await createView(name)
    }
  }

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && closeViewDialog()}>
      <DialogContent className='sm:max-w-sm' showCloseButton={false}>
        <form onSubmit={(event) => void handleSubmit(event)} className='flex flex-col gap-4'>
          <div className='flex flex-col gap-1'>
            <DialogTitle>{text.title}</DialogTitle>
            <DialogDescription>{text.description(view?.name ?? '')}</DialogDescription>
          </div>
          <Field>
            <FieldLabel htmlFor='view-name'>Name</FieldLabel>
            <Input
              key={`${mode}-${view?.id}`}
              id='view-name'
              name='name'
              required
              maxLength={80}
              autoComplete='off'
              autoFocus
              defaultValue={mode === 'rename' ? view?.name : mode === 'duplicate' ? `${view?.name ?? ''} copy` : ''}
              placeholder='For example: Work this week'
            />
          </Field>
          <div className='flex justify-end gap-2'>
            <DialogClose render={<Button type='button' variant='ghost' />}>Cancel</DialogClose>
            <Button type='submit'>{text.action}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
