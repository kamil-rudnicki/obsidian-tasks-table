// Blockquote and callout markers before a line's content, such as `> ` or `> > `.
const quotePattern = /^(?:[ \t]*>[ \t]?)*/u
const listItemPattern = /^([ \t]*)(?:[-*+]|\d+[.)])(?:[ \t]|$)/u

// A tab indents as far as four spaces.
const getWidth = (whitespace: string): number =>
  [...whitespace].reduce((width, character) => width + (character === '\t' ? 4 : 1), 0)

// Reads a note line by line and gives each list item its level: 1 for an item
// that is not inside another list item, 2 for an item inside one, and so on.
// As in `getTaskBlock`, an item is inside the item above it that is indented
// less, in the same blockquote; blank lines keep a list open, and text that is
// not indented more than an item closes it.
export const createListLevelReader = () => {
  let quoteDepth = 0
  // The indents of the list items that the next line can be inside.
  const parents: number[] = []

  return (line: string): number | null => {
    const quote = quotePattern.exec(line)?.[0] ?? ''
    const content = line.slice(quote.length)

    if (content.trim() === '') {
      return null
    }

    const depth = quote.split('>').length - 1
    if (depth !== quoteDepth) {
      quoteDepth = depth
      parents.length = 0
    }

    const item = listItemPattern.exec(content)
    const indent = getWidth(item ? item[1] : (/^[ \t]*/u.exec(content)?.[0] ?? ''))

    while (parents.length > 0 && parents[parents.length - 1] >= indent) {
      parents.pop()
    }

    if (!item) {
      return null
    }

    parents.push(indent)
    return parents.length
  }
}
