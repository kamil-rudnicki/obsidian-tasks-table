import { describe, expect, test } from 'vitest'
import { addTaskComment, applyTaskChanges, createTaskLine, editTaskComment } from './taskLine'

const emojiOptions = { format: 'emoji', today: '2026-10-31', setDoneDate: true } as const
const dataviewOptions = { ...emojiOptions, format: 'dataview' } as const

describe('applyTaskChanges', () => {
  test('completes a task and adds the done date in the configured format', () => {
    expect(applyTaskChanges('- [ ] Ship it', { status: 'done' }, emojiOptions)).toBe(
      '- [x] Ship it ✅ 2026-10-31',
    )
    expect(applyTaskChanges('- [ ] Ship it', { status: 'done' }, dataviewOptions)).toBe(
      '- [x] Ship it [completion:: 2026-10-31]',
    )
  })

  test('does not add a done date when the setting is off', () => {
    expect(
      applyTaskChanges('- [ ] Ship it', { status: 'done' }, { ...emojiOptions, setDoneDate: false }),
    ).toBe('- [x] Ship it')
  })

  test('reopens a task and removes its done date in the original format', () => {
    expect(
      applyTaskChanges('\t- [x] Ship it [completion:: 2025-07-27] ^abc', { status: 'todo' }, emojiOptions),
    ).toBe('\t- [ ] Ship it ^abc')
    expect(applyTaskChanges('- [x] Ship it ✅ 2024-01-28', { status: 'in_progress' }, emojiOptions)).toBe(
      '- [/] Ship it',
    )
  })

  test('cancels a task with a cancelled date', () => {
    expect(applyTaskChanges('- [ ] Plan', { status: 'cancelled' }, emojiOptions)).toBe(
      '- [-] Plan ❌ 2026-10-31',
    )
  })

  test('puts a task off for later and removes its done date', () => {
    expect(applyTaskChanges('- [ ] Plan', { status: 'later' }, emojiOptions)).toBe('- [>] Plan')
    expect(applyTaskChanges('- [x] Plan ✅ 2024-01-28', { status: 'later' }, emojiOptions)).toBe('- [>] Plan')
  })

  test('keeps an unknown status symbol when the status does not change', () => {
    expect(applyTaskChanges('- [?] Ask', { status: 'todo', priority: 'high' }, emojiOptions)).toBe(
      '- [?] Ask ⏫',
    )
  })

  test('replaces existing metadata in place and keeps its format', () => {
    expect(
      applyTaskChanges(
        '- [ ] Call 📅 2026-01-01 #work [priority:: low]',
        { dueDate: '2026-02-02', priority: 'high' },
        emojiOptions,
      ),
    ).toBe('- [ ] Call 📅 2026-02-02 #work [priority:: high]')
  })

  test('removes metadata when the value is cleared', () => {
    expect(
      applyTaskChanges(
        '- [ ] Call ⏫ 📅 2026-01-01 #work',
        { dueDate: null, priority: 'normal' },
        emojiOptions,
      ),
    ).toBe('- [ ] Call #work')
  })

  test('appends new metadata before a block id', () => {
    expect(
      applyTaskChanges('- [ ] Call ^block-1', { scheduledDate: '2026-11-05' }, dataviewOptions),
    ).toBe('- [ ] Call [scheduled:: 2026-11-05] ^block-1')
  })

  test('changes the description and keeps metadata and the block id', () => {
    expect(
      applyTaskChanges(
        '  - [ ] Old [id:: 7] 📅 2026-01-01 text ^b1',
        { description: '  New   title #tag [id:: 7] ' },
        emojiOptions,
      ),
    ).toBe('  - [ ] New title #tag [id:: 7] 📅 2026-01-01 ^b1')
  })

  test('removes duplicate metadata for one field', () => {
    expect(
      applyTaskChanges('- [ ] Two 📅 2026-01-01 [due:: 2026-01-02]', { dueDate: '2026-03-03' }, emojiOptions),
    ).toBe('- [ ] Two 📅 2026-03-03')
  })

  test('leaves lines that are not tasks unchanged', () => {
    expect(applyTaskChanges('Just text', { status: 'done' }, emojiOptions)).toBe('Just text')
  })
})

describe('tags', () => {
  const setTags = (line: string, tags: string[]): string => applyTaskChanges(line, { tags }, emojiOptions)

  test('adds tags after the text and before the metadata', () => {
    expect(setTags('- [ ] Buy milk 📅 2026-11-01 ^abc', ['home', 'errand'])).toBe(
      '- [ ] Buy milk #home #errand 📅 2026-11-01 ^abc',
    )
    expect(setTags('- [ ] Buy milk #shop ⏫', ['shop', 'home'])).toBe('- [ ] Buy milk #shop #home ⏫')
    expect(setTags('- [ ] Email admin [id:: 134]', ['type/task'])).toBe('- [ ] Email admin #type/task [id:: 134]')
    expect(setTags('- [ ] Water 🔁 every week 📅 2026-11-01', ['garden'])).toBe(
      '- [ ] Water #garden 🔁 every week 📅 2026-11-01',
    )
  })

  test('adds tags to a task without text', () => {
    expect(setTags('- [ ]', ['inbox'])).toBe('- [ ] #inbox')
    expect(setTags('- [ ] 📅 2026-11-01', ['inbox'])).toBe('- [ ] #inbox 📅 2026-11-01')
  })

  test('removes tags wherever they are written', () => {
    expect(setTags('- [ ] #work Call #ann about #plan 📅 2026-11-01', ['ann'])).toBe(
      '- [ ] Call #ann about 📅 2026-11-01',
    )
    expect(setTags('- [ ] Call #a #b ^id', [])).toBe('- [ ] Call ^id')
    expect(setTags('  - [x] #only', [])).toBe('  - [x]')
  })

  test('removes and adds tags in one change', () => {
    expect(setTags('- [ ] Plan #old trip [due:: 2026-11-01]', ['new'])).toBe(
      '- [ ] Plan trip #new [due:: 2026-11-01]',
    )
  })

  test('keeps text that only looks like a tag', () => {
    expect(setTags('- [ ] Fix #1 in [[#Heading]] and `#code` #bug', [])).toBe(
      '- [ ] Fix #1 in [[#Heading]] and `#code`',
    )
    expect(setTags('- [ ] Plan #work/project', ['work'])).toBe('- [ ] Plan #work')
  })

  test('writes the tags in the new order, each in a place a tag had', () => {
    expect(setTags('- [ ] Fix login #type/dev #project/app 📅 2026-11-03', ['project/app', 'type/dev'])).toBe(
      '- [ ] Fix login #project/app #type/dev 📅 2026-11-03',
    )
    expect(setTags('- [ ] #work Call #ann about the plan ^b1', ['ann', 'work'])).toBe(
      '- [ ] #ann Call #work about the plan ^b1',
    )
    expect(setTags('- [ ] Fix #a #b', ['c', 'b', 'a'])).toBe('- [ ] Fix #c #b #a')
    expect(setTags('- [ ] Fix #a #b #a again', ['b', 'a'])).toBe('- [ ] Fix #b #a #a again')
    expect(setTags('- [ ] Fix #a #b [comment_2026-11-01 10:00:: about #c]', ['b', 'a'])).toBe(
      '- [ ] Fix #b #a [comment_2026-11-01 10:00:: about #c]',
    )
  })

  test('changes nothing when the tags are the same', () => {
    expect(setTags('- [ ] Call  #a   now', ['a'])).toBe('- [ ] Call  #a   now')
  })
})

describe('comments', () => {
  const comment = { time: '2026-11-01 14:30', text: 'Called the vendor' }

  test('adds the first comment after the text, before the Tasks metadata', () => {
    expect(addTaskComment('- [ ] Call vendor #work ⏫ 📅 2026-11-03 ^abc', comment)).toBe(
      '- [ ] Call vendor #work [comment_2026-11-01 14:30:: Called the vendor] ⏫ 📅 2026-11-03 ^abc',
    )
  })

  test('adds a comment after the last one', () => {
    expect(addTaskComment('- [ ] Call [comment_2026-10-30 09:12:: Left a message] 📅 2026-11-03', comment)).toBe(
      '- [ ] Call [comment_2026-10-30 09:12:: Left a message] [comment_2026-11-01 14:30:: Called the vendor] 📅 2026-11-03',
    )
  })

  test('edits only the chosen comment when timestamps and text repeat', () => {
    const line = '\t- [/] Call #work [comment_2026-11-01 14:30:: Called the vendor] [comment_2026-11-01 14:30:: Called the vendor] ⏫ 📅 2026-11-03 [owner:: Ann] ^abc'
    expect(editTaskComment(line, { index: 1, original: comment, text: 'See [[Notes]] and [docs](https://example.com)' })).toBe(
      '\t- [/] Call #work [comment_2026-11-01 14:30:: Called the vendor] [comment_2026-11-01 14:30:: See [[Notes]] and [docs](https://example.com)] ⏫ 📅 2026-11-03 [owner:: Ann] ^abc',
    )
  })

  test('normalizes and escapes edited comments so they read back unchanged', () => {
    const line = '- [ ] Call [comment_2026-11-01 14:30:: Called the vendor]'
    const edited = editTaskComment(line, { index: 0, original: comment, text: 'Ask  about\nthe ] key' })
    expect(edited).toBe('- [ ] Call [comment_2026-11-01 14:30:: Ask about the \\] key]')
    expect(editTaskComment(edited, {
      index: 0,
      original: { ...comment, text: 'Ask about the ] key' },
      text: 'Answered',
    })).toBe('- [ ] Call [comment_2026-11-01 14:30:: Answered]')
  })

  test('refuses to overwrite a changed, removed or shifted comment', () => {
    const edit = { index: 0, original: comment, text: 'New text' }
    for (const line of [
      '- [ ] Call',
      '- [ ] Call [comment_2026-11-01 14:30:: Changed in the note]',
      '- [ ] Call [comment_2026-11-02 14:30:: Called the vendor]',
      '- [ ] Call [comment_2026-11-01 14:29:: Earlier] [comment_2026-11-01 14:30:: Called the vendor]',
    ]) {
      expect(() => editTaskComment(line, edit)).toThrow('This comment changed in the note')
    }
  })

  test('writes the comment on one line and escapes brackets Dataview would end it at', () => {
    expect(addTaskComment('- [ ] Call', { ...comment, text: 'Ask  about\nthe ] key' })).toBe(
      '- [ ] Call [comment_2026-11-01 14:30:: Ask about the \\] key]',
    )
    expect(addTaskComment('- [ ] Call', { ...comment, text: 'See [[Notes]] and [docs](https://example.com)' })).toBe(
      '- [ ] Call [comment_2026-11-01 14:30:: See [[Notes]] and [docs](https://example.com)]',
    )
  })

  test('keeps comments, and the tags in them, when the title or the tags change', () => {
    const line = '- [ ] Plan #a [comment_2026-10-30 09:12:: About #b] 📅 2026-11-03'

    expect(applyTaskChanges(line, { description: 'New title #a' }, emojiOptions)).toBe(
      '- [ ] New title #a [comment_2026-10-30 09:12:: About #b] 📅 2026-11-03',
    )
    expect(applyTaskChanges(line, { tags: ['c'] }, emojiOptions)).toBe(
      '- [ ] Plan #c [comment_2026-10-30 09:12:: About #b] 📅 2026-11-03',
    )
  })
})

describe('createTaskLine', () => {
  test('creates a task line with metadata', () => {
    expect(
      createTaskLine(' Write  report ', { priority: 'medium', dueDate: '2026-11-03' }, {
        ...dataviewOptions,
        setCreatedDate: false,
      }),
    ).toBe('- [ ] Write report [priority:: medium] [due:: 2026-11-03]')
  })

  test('adds the created date when the setting is on', () => {
    expect(createTaskLine('Call Ann', {}, { ...emojiOptions, setCreatedDate: true })).toBe(
      '- [ ] Call Ann ➕ 2026-10-31',
    )
    expect(createTaskLine('Call Ann', {}, { ...dataviewOptions, setCreatedDate: true })).toBe(
      '- [ ] Call Ann [created:: 2026-10-31]',
    )
  })
})
