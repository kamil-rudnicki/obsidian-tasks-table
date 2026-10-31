import type { TaskLink } from '@shared/taskTypes'

const inlineCodePattern = /`[^`]*`/gu

// Wiki links and embeds, Markdown links, and bare web addresses, in the order they appear.
const linkPattern =
  /!?\[\[(?<wikiTarget>[^\]|]*)(?:\|(?<wikiAlias>[^\]]*))?\]\]|\[(?<markdownText>[^\]]*)\]\((?<markdownTarget><[^>]*>|[^)\s]+)(?:\s+"[^"]*")?\)|(?<address>\b(?:https?|mailto):[^\s<>()[\]]+)/gu

const schemePattern = /^[a-z][a-z0-9+.-]*:/iu

const getNoteName = (target: string): string => target.split('#')[0].split('/').pop() ?? ''

// Shorter text for a web address: without the protocol and a trailing slash.
const getAddressText = (address: string): string =>
  address.replace(/^(?:https?:\/\/|mailto:)/iu, '').replace(/\/$/u, '')

const decodeTarget = (target: string): string => {
  const unwrapped = target.replace(/^<|>$/gu, '')
  try {
    return decodeURI(unwrapped)
  } catch {
    return unwrapped
  }
}

export const extractLinks = (text: string): TaskLink[] => {
  const links: TaskLink[] = []
  const seen = new Set<string>()
  const add = (link: TaskLink): void => {
    if (link.target !== '' && !seen.has(link.target)) {
      seen.add(link.target)
      links.push(link)
    }
  }
  // Inline code holds examples, not links.
  const searchable = text.replace(inlineCodePattern, (code) => ' '.repeat(code.length))

  for (const match of searchable.matchAll(linkPattern)) {
    const { wikiTarget, wikiAlias, markdownText, markdownTarget, address } = match.groups ?? {}

    if (wikiTarget !== undefined) {
      const target = wikiTarget.trim()
      add({ target, text: wikiAlias?.trim() || getNoteName(target) || target, external: false })
    } else if (markdownTarget !== undefined) {
      const target = decodeTarget(markdownTarget)
      const external = schemePattern.test(target)
      const fallback = external ? getAddressText(target) : getNoteName(target).replace(/\.md$/iu, '')
      add({ target, text: markdownText?.trim() || fallback, external })
    } else if (address !== undefined) {
      // A sentence may end right after an address.
      const target = address.replace(/[.,;:!?]+$/u, '')
      add({ target, text: getAddressText(target), external: true })
    }
  }

  return links
}
