import { describe, expect, test } from 'vitest'
import { extractTags, findTagRanges, getDescriptionEnd, parseTaskLine } from './taskLineSyntax'

describe('parseTaskLine', () => {
  test('returns null for lines that are not tasks', () => {
    expect(parseTaskLine('Plain text')).toBeNull()
    expect(parseTaskLine('- list item')).toBeNull()
    expect(parseTaskLine('[ ] no bullet')).toBeNull()
  })

  test.each([
    ['- [ ] Buy milk', 'todo', ' '],
    ['- [x] Buy milk', 'done', 'x'],
    ['- [X] Buy milk', 'done', 'X'],
    ['- [/] Buy milk', 'in_progress', '/'],
    ['- [-] Buy milk', 'cancelled', '-'],
    ['- [>] Buy milk', 'todo', '>'],
  ])('reads the status of %s', (line, status, symbol) => {
    expect(parseTaskLine(line)).toMatchObject({ status, statusSymbol: symbol })
  })

  test('reads indented, ordered and quoted tasks', () => {
    expect(parseTaskLine('\t\t- [ ] Nested')?.prefix).toBe('\t\t- ')
    expect(parseTaskLine('    * [ ] Star')?.description).toBe('Star')
    expect(parseTaskLine('1. [ ] Ordered')?.description).toBe('Ordered')
    expect(parseTaskLine('> - [ ] Quoted')?.description).toBe('Quoted')
  })

  test('reads Tasks emoji metadata and removes it from the description', () => {
    const parsed = parseTaskLine(
      '- [ ] Pay rent ⏫ 📅 2026-11-01 ⏳ 2026-10-30 ➕ 2026-10-01 ^rent-1',
    )

    expect(parsed).toMatchObject({
      description: 'Pay rent',
      priority: 'high',
      dates: {
        dueDate: '2026-11-01',
        scheduledDate: '2026-10-30',
        createdDate: '2026-10-01',
        doneDate: null,
      },
    })
  })

  test('reads Dataview metadata and keeps unknown fields in the description', () => {
    const parsed = parseTaskLine(
      '- [x] Backups [priority:: highest] (due:: 2026-11-02) [completion:: 2025-07-27] [id:: 2148]',
    )

    expect(parsed).toMatchObject({
      description: 'Backups [id:: 2148]',
      priority: 'highest',
      dates: { dueDate: '2026-11-02', doneDate: '2025-07-27' },
    })
  })

  test('ignores metadata inside links and inline code', () => {
    const parsed = parseTaskLine('- [ ] Read [[⏫ plans]] and `📅 2026-01-01`')

    expect(parsed).toMatchObject({
      description: 'Read [[⏫ plans]] and `📅 2026-01-01`',
      priority: 'normal',
      dates: { dueDate: null },
    })
  })

  test('skips an emoji that has no date', () => {
    expect(parseTaskLine('- [ ] Open [[✅ tasks]] ✅ list')?.description).toBe(
      'Open [[✅ tasks]] ✅ list',
    )
  })
})

describe('extractTags', () => {
  test('finds Obsidian tags and ignores numbers, headings in code and links', () => {
    expect(
      extractTags('#type/task Email #1 issue#x `#code` [[#heading]] #duration/ping #Type/Task'),
    ).toEqual(['type/task', 'duration/ping', 'Type/Task'])
  })
})

describe('findTagRanges', () => {
  test('finds where each tag is written', () => {
    const text = '#a Buy #b/c [[#d]] `#e` #1'
    expect(findTagRanges(text).map(({ tag, start, end }) => [tag, text.slice(start, end)])).toEqual([
      ['a', '#a'],
      ['b/c', '#b/c'],
    ])
  })
})

describe('getDescriptionEnd', () => {
  const descriptionOf = (line: string): string => {
    const parsed = parseTaskLine(line)
    return parsed ? parsed.body.slice(0, getDescriptionEnd(parsed)) : ''
  }

  test.each([
    ['- [ ] Buy milk', 'Buy milk'],
    ['- [ ] Buy milk #home 📅 2026-11-01 ⏫ ^abc', 'Buy milk #home'],
    ['- [ ] Email admin [id:: 134] [due:: 2026-11-01]', 'Email admin'],
    ['- [ ] Hidden (type:: work) (due:: 2026-11-01)', 'Hidden'],
    ['- [ ] Water plants 🔁 every week 📅 2026-11-01', 'Water plants'],
    ['- [ ] Ship 🆔 abc123 ⛔ def456, ghi789 🏁 delete', 'Ship'],
    ['- [ ] Field [type:: work] in the middle', 'Field [type:: work] in the middle'],
    ['- [ ] Read [[Note]]', 'Read [[Note]]'],
    ['- [ ] 📅 2026-11-01', ''],
    ['- [ ]', ''],
  ])('finds the text of %s', (line, description) => {
    expect(descriptionOf(line)).toBe(description)
  })
})

describe('comments', () => {
  test('reads comments and keeps them out of the description, tags, fields and dates', () => {
    expect(
      parseTaskLine('- [ ] Plan [comment_2026-10-30 09:12:: Asked Ann about #budget, moved to 📅 2026-11-05] 📅 2026-11-03'),
    ).toMatchObject({
      description: 'Plan',
      tags: [],
      fields: {},
      dates: { dueDate: '2026-11-03' },
      comments: [{ time: '2026-10-30 09:12', text: 'Asked Ann about #budget, moved to 📅 2026-11-05' }],
    })
  })

  test('reads links and escaped brackets in comments', () => {
    expect(
      parseTaskLine(
        '- [ ] Read [comment_2026-10-30:: See [[Notes|notes]] and [docs](https://example.com)] [comment_2026-10-31:: a \\] b]',
      )?.comments.map(({ time, text }) => ({ time, text })),
    ).toEqual([
      { time: '2026-10-30', text: 'See [[Notes|notes]] and [docs](https://example.com)' },
      { time: '2026-10-31', text: 'a ] b' },
    ])
  })

  test('ignores comments in inline code and links', () => {
    expect(parseTaskLine('- [ ] Code `[comment_2026-10-30:: no]` [[comment_2026-10-30:: no]]')?.comments).toEqual([])
  })

  test('finds the text before the comments', () => {
    const parsed = parseTaskLine('- [ ] Call #work [comment_2026-10-30 09:12:: Left a message] 📅 2026-11-03')
    expect(parsed ? parsed.body.slice(0, getDescriptionEnd(parsed)) : '').toBe('Call #work')
  })
})

describe('inline fields', () => {
  test.each([
    ['- [ ] Email admin [type:: work] [id:: 134]', { type: 'work', id: '134' }],
    ['- [ ] Pay [due:: 2026-11-01] [priority:: high] [completion:: 2026-11-02]', {}],
    ['- [ ] Read [source:: [[Meeting notes|Notes]]]', { source: '[[Meeting notes|Notes]]' }],
    ['- [ ] Call [Type:: Work] [Person name:: Ann]', { type: 'Work', 'person name': 'Ann' }],
    ['- [ ] Plan [area:: home] [area:: garden]', { area: 'home, garden' }],
    ['- [ ] Code `[type:: work]` and [[Note]]', {}],
    ['- [ ] Hidden key (type:: work)', {}],
    ['- [ ] Empty [type:: ]', { type: '' }],
    ['- [ ] Log [24176 CFrame.cpp->CFrame::CFrame:467] [Agent 2026-06-14:: Checked]', { 'agent 2026-06-14': 'Checked' }],
  ])('reads %s', (line, fields) => {
    expect(parseTaskLine(line)?.fields).toEqual(fields)
  })

  test('keeps fields in the description, so edits to the text keep them', () => {
    expect(parseTaskLine('- [ ] Email admin [type:: work] 📅 2026-11-01')?.description).toBe(
      'Email admin [type:: work]',
    )
  })
})
