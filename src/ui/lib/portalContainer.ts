import { createContext, useContext } from 'react'

// Popups render into a scoped element at the end of the window's body, so the
// plugin's styles apply to them and Obsidian's styles stay out of them.
export const PortalContainerContext = createContext<HTMLElement | null>(null)

export const usePortalContainer = (): HTMLElement | undefined =>
  useContext(PortalContainerContext) ?? undefined
