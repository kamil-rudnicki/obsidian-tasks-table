import { hashString } from '@shared/hash'
import { tagSchema } from '@shared/taskTypes'

// Obsidian's accent colors, in the order of the color wheel.
export const tagColors = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'] as const
export type TagColor = (typeof tagColors)[number]

// A tag keeps its color everywhere and on every start. Obsidian tags ignore case.
export const getTagColor = (tag: string): TagColor =>
  tagColors[Number.parseInt(hashString(tag.toLocaleLowerCase()).slice(0, 8), 16) % tagColors.length]

// What the typed text searches for: tags have no `#` and no spaces.
export const toTagQuery = (input: string): string => input.trim().replace(/^#+/u, '').replace(/\s+/gu, '-')

// The tag that typed text adds: spaces become dashes and characters that a tag
// cannot hold are left out. Null when no valid tag is left.
export const toTagName = (input: string): string | null => {
  const name = toTagQuery(input).replace(/[^\p{L}\p{N}_/-]/gu, '')
  return tagSchema.safeParse(name).success ? name : null
}

type TagEditorItems = {
  items: string[]
  // The typed tag when no tag in the list has that name yet.
  newTag: string | null
}

// The vault's tags that match the typed text, most used first, then selected
// tags that no note has yet, then the typed tag to add.
export const getTagEditorItems = (options: string[], selected: string[], input: string): TagEditorItems => {
  const query = toTagQuery(input).toLocaleLowerCase()
  const matches = (tag: string): boolean => tag.toLocaleLowerCase().includes(query)
  const items = [...new Set([...options, ...selected].filter(matches))]
  const typed = toTagName(input)
  const newTag =
    typed !== null && !items.some((tag) => tag.toLocaleLowerCase() === typed.toLocaleLowerCase()) ? typed : null

  return { items: newTag === null ? items : [...items, newTag], newTag }
}
