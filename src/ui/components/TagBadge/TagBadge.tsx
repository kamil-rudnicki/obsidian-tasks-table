import type { MouseEvent, PointerEvent } from 'react'
import { XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTagColor } from '@/logic/tagLogic'

// `data-tag-color` sets `--tag-accent` and `--tag-foreground` (see app.css). The
// text color is important: highlighted menu items set the color of all their content.
export const tagColorClassName = 'bg-(--tag-accent)/18 text-(--tag-foreground)!'

// The press must not reach the cell's button around the badge, which opens the editor.
const stopPress = (event: PointerEvent | MouseEvent): void => {
  event.preventDefault()
  event.stopPropagation()
}

// A tag pill shaped like Obsidian's own tags, in the tag's color. With
// `onRemove`, pointing at it shows an × over the end of its text, which fades
// out under it, so the pill keeps its width. The × is for the mouse only: it
// sits in a button, and the tag editor removes tags for the keyboard.
export const TagBadge = ({ tag, className, onRemove }: { tag: string; className?: string; onRemove?: () => void }) => (
  <span
    data-tag-color={getTagColor(tag)}
    className={cn(
      'group/tag relative shrink-0 rounded-(--tag-radius) px-(--tag-padding-x) py-px text-xs whitespace-nowrap',
      tagColorClassName,
      className,
    )}
  >
    {onRemove ? (
      <>
        <span className='[@media(hover:hover)]:group-hover/tag:[mask-image:linear-gradient(to_left,transparent_1rem,black_1.75rem)]'>
          #{tag}
        </span>
        <span
          aria-hidden='true'
          data-slot='tag-remove'
          className='pointer-events-none absolute inset-y-0 end-0 flex items-center pe-1 opacity-0 [@media(hover:hover)]:group-hover/tag:pointer-events-auto [@media(hover:hover)]:group-hover/tag:opacity-100'
          onPointerDown={stopPress}
          onMouseDown={stopPress}
          onClick={(event) => {
            stopPress(event)
            onRemove()
          }}
        >
          <XIcon className='size-3 opacity-70 [@media(hover:hover)]:hover:opacity-100' />
        </span>
      </>
    ) : (
      `#${tag}`
    )}
  </span>
)

// The ring keeps dots apart where a filter chip stacks them.
export const TagColorDot = ({ tag }: { tag: string }) => (
  <span
    aria-hidden='true'
    data-tag-color={getTagColor(tag)}
    className='block size-2 shrink-0 rounded-full bg-(--tag-accent) ring-2 ring-background'
  />
)
