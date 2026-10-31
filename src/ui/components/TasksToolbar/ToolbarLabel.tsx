import type { ReactNode } from 'react'

// Toolbar buttons show only their icon when the view is narrow, so the toolbar
// keeps one row. The label stays for screen readers. An `aria-label` is not used:
// Obsidian shows a tooltip for every element that has one.
export const ToolbarLabel = ({ children }: { children: ReactNode }) => (
  <span className='sr-only @3xl/tasks:not-sr-only'>{children}</span>
)
