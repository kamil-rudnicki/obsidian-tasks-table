import { cn } from '@/lib/utils'
import { getTagColor } from '@/logic/tagLogic'

// `data-tag-color` sets `--tag-accent` and `--tag-foreground` (see app.css). The
// text color is important: highlighted menu items set the color of all their content.
export const tagColorClassName = 'bg-(--tag-accent)/18 text-(--tag-foreground)!'

// A tag pill shaped like Obsidian's own tags, in the tag's color.
export const TagBadge = ({ tag, className }: { tag: string; className?: string }) => (
  <span
    data-tag-color={getTagColor(tag)}
    className={cn(
      'shrink-0 rounded-(--tag-radius) px-(--tag-padding-x) py-px text-xs whitespace-nowrap',
      tagColorClassName,
      className,
    )}
  >
    #{tag}
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
