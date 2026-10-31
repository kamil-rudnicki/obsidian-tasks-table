// Runs a script against the Obsidian started by launch.mjs:
// `PORT=9333 node e2e/cdp.mjs path/to/script.mjs`. The script's default export
// receives the Playwright page of the Obsidian workspace.
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright-core'

const port = Number(process.env.PORT ?? 9333)
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
const pages = browser.contexts().flatMap((context) => context.pages())
const page = pages.find((candidate) => candidate.url().startsWith('app://obsidian.md')) ?? pages[0]
const script = await import(pathToFileURL(path.resolve(process.argv[2])).href)

try {
  const result = await script.default(page)
  if (result !== undefined) {
    console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2))
  }
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
process.exit()
