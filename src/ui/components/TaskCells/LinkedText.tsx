import { ArrowUpRightIcon } from 'lucide-react'
import { getTextParts } from '@/logic/taskDisplayLogic'

const linkClassName =
  'rounded-sm text-link underline decoration-link/40 underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [@media(hover:hover)]:hover:text-link-hover [@media(hover:hover)]:hover:decoration-link-hover'

// A comment or an inline field value as it reads in the note, with its links
// ready to open: web pages, Obsidian links, and agent chats.
export const LinkedText = ({ text }: { text: string }) =>
  getTextParts(text).map((part, index) =>
    part.url ? (
      // Obsidian opens the address in its app, such as the browser.
      <a key={index} href={part.url} target='_blank' rel='noopener noreferrer' className={linkClassName}>
        {part.text}
        <ArrowUpRightIcon aria-hidden='true' className='ms-0.5 inline-block size-3 align-[-1px]' />
      </a>
    ) : (
      <span key={index}>{part.text}</span>
    ),
  )
