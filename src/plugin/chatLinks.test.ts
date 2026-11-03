import { describe, expect, test } from 'vitest'
import { createChatLink, createTaskPrompt } from './chatLinks'

const folder = '/Users/kamil/Developer/personal-productivity'

describe('chat links', () => {
  test('asks for help with the task, and for a comment with a link to the chat', () => {
    const prompt = createTaskPrompt({
      app: 'claude',
      line: '\t- [ ] Call the vendor 📅 2026-11-03',
      notePath: '/Vault/Notes/Calls.md',
      time: '2026-11-03 14:30',
    })

    expect(prompt.split('\n\n')).toEqual([
      'Help me with this task - [ ] Call the vendor 📅 2026-11-03 /Vault/Notes/Calls.md.',
      "Before you start, add this comment to that task's line in the note: [comment_2026-11-03 14:30:: Agent is running in claude://code/continue?session={id}], " +
        'with {id} replaced by the value of the CLAUDE_CODE_HOST_SESSION_ID environment variable. If that variable is empty, write Claude in place of the link. ' +
        'A comment is [comment_YYYY-MM-DD HH:mm:: text] with the local date and time. It goes after the task text and its other comments, before its dates and fields, such as 📅 2026-11-05.',
    ])
  })

  test('asks ChatGPT for a link to its thread', () => {
    const prompt = createTaskPrompt({ app: 'chatgpt', line: '- [ ] Call', notePath: '/Vault/Calls.md', time: '2026-11-03 14:30' })

    expect(prompt).toContain('[comment_2026-11-03 14:30:: Agent is running in codex://threads/{id}]')
    expect(prompt).toContain('the value of the CODEX_THREAD_ID environment variable')
  })

  test('opens a new ChatGPT chat in the folder with the prompt', () => {
    const link = createChatLink('chatgpt', folder, 'Help me & you?')

    expect(link).toBe(
      'codex://threads/new?path=%2FUsers%2Fkamil%2FDeveloper%2Fpersonal-productivity&prompt=Help%20me%20%26%20you%3F',
    )
    const params = new URL(link).searchParams
    expect(params.get('path')).toBe(folder)
    expect(params.get('prompt')).toBe('Help me & you?')
  })

  test('opens a new Claude Code session in the folder with the prompt', () => {
    const link = createChatLink('claude', folder, 'Help me & you?')

    expect(link).toBe(
      'claude://code/new?folder=%2FUsers%2Fkamil%2FDeveloper%2Fpersonal-productivity&q=Help%20me%20%26%20you%3F',
    )
    const params = new URL(link).searchParams
    expect(params.get('folder')).toBe(folder)
    expect(params.get('q')).toBe('Help me & you?')
  })
})
