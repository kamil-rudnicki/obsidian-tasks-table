import { describe, expect, test } from 'vitest'
import { extractLinks } from './taskLinks'

describe('extractLinks', () => {
  test('reads wiki links with aliases, headings and embeds', () => {
    expect(extractLinks('See [[Projects/Website#Plan|the plan]] and [[Roadmap]] ![[diagram.png]]')).toEqual([
      { target: 'Projects/Website#Plan', text: 'the plan', external: false },
      { target: 'Roadmap', text: 'Roadmap', external: false },
      { target: 'diagram.png', text: 'diagram.png', external: false },
    ])
  })

  test('reads Markdown links to notes and to the web', () => {
    expect(extractLinks('[Gmail](https://mail.google.com/mail/#all/19f3) [notes](Meeting%20notes.md)')).toEqual([
      { target: 'https://mail.google.com/mail/#all/19f3', text: 'Gmail', external: true },
      { target: 'Meeting notes.md', text: 'notes', external: false },
    ])
  })

  test('reads bare web addresses without trailing punctuation', () => {
    expect(extractLinks('PC: https://example.atlassian.net/browse/TCD-12106, then mailto:ann@example.com.')).toEqual([
      { target: 'https://example.atlassian.net/browse/TCD-12106', text: 'example.atlassian.net/browse/TCD-12106', external: true },
      { target: 'mailto:ann@example.com', text: 'ann@example.com', external: true },
    ])
  })

  test('finds links inside inline fields, once each, and none in code', () => {
    expect(extractLinks('[person:: [[Ann]]] [[Ann]] `[[Not a link]]`')).toEqual([
      { target: 'Ann', text: 'Ann', external: false },
    ])
  })
})
