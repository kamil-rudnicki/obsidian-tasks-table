import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { watchDay } from './dayWatcher'

// Stands in for the plugin: keeps the DOM listeners, so a test can call them.
const watch = () => {
  const listeners = new Map<string, () => void>()
  const onDayChanged = vi.fn()
  watchDay(
    {
      registerInterval: (id: number) => id,
      registerDomEvent: (_target: unknown, type: string, listener: () => void) => {
        listeners.set(type, listener)
      },
    } as unknown as Parameters<typeof watchDay>[0],
    onDayChanged,
  )
  return { onDayChanged, fire: (type: string) => listeners.get(type)?.() }
}

describe('watchDay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 22, 23, 59, 0))
    Object.assign(globalThis, { document: {} })
  })

  afterEach(() => {
    vi.useRealTimers()
    Reflect.deleteProperty(globalThis, 'document')
  })

  test('tells the new day once, soon after midnight', () => {
    const { onDayChanged } = watch()
    vi.advanceTimersByTime(59_000)
    expect(onDayChanged).not.toHaveBeenCalled()
    vi.advanceTimersByTime(31_000)
    expect(onDayChanged.mock.calls).toEqual([['2026-11-23']])
    vi.advanceTimersByTime(60 * 60_000)
    expect(onDayChanged).toHaveBeenCalledTimes(1)
  })

  test.each(['focus', 'visibilitychange'])('checks at once on %s, as after the computer sleeps', (type) => {
    const { onDayChanged, fire } = watch()
    fire(type)
    expect(onDayChanged).not.toHaveBeenCalled()
    // Sleep: the clock moves on, the timers do not.
    vi.setSystemTime(new Date(2026, 10, 24, 8, 19, 0))
    fire(type)
    expect(onDayChanged.mock.calls).toEqual([['2026-11-24']])
  })

  test('follows a clock or time zone that moves back', () => {
    const { onDayChanged, fire } = watch()
    vi.setSystemTime(new Date(2026, 10, 21, 12, 0, 0))
    fire('focus')
    expect(onDayChanged.mock.calls).toEqual([['2026-11-21']])
  })
})
