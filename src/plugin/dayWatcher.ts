import type { Plugin } from 'obsidian'
import { getToday } from '@shared/dateLogic'

// A timer set for midnight would be late after the computer sleeps, as timers
// stop during sleep. A short check is right again soon after the wake-up.
const checkIntervalMs = 30_000

// Calls `onDayChanged` when the local date changes while the plugin runs, and
// checks at once when you come back to Obsidian.
export const watchDay = (
  plugin: Pick<Plugin, 'registerInterval' | 'registerDomEvent'>,
  onDayChanged: (today: string) => void,
): void => {
  let today = getToday()
  const check = (): void => {
    const current = getToday()
    if (current !== today) {
      today = current
      onDayChanged(current)
    }
  }

  plugin.registerInterval(window.setInterval(check, checkIntervalMs))
  plugin.registerDomEvent(window, 'focus', check)
  plugin.registerDomEvent(window.document, 'visibilitychange', check)
}
