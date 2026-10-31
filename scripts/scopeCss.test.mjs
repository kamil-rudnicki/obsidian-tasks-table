import postcss from 'postcss'
import { describe, expect, test } from 'vitest'
import { scopeCss } from './scopeCss.mjs'

const scope = ':is(.tasks-table-scope, #tasks-table-scope)'

const run = async (css) => (await postcss([scopeCss()]).process(css, { from: undefined })).css

describe('scopeCss', () => {
  test('scopes selectors and turns the document root into the scope element', async () => {
    const css = await run(':root, :host { --a: 1 } html { color: red } .flex, *::before { display: flex }')

    expect(css).toContain(`${scope} { --a: 1 }`)
    expect(css).toContain(`${scope} { color: red }`)
    expect(css).toContain(`${scope} .flex, ${scope} *::before { display: flex }`)
  })

  test('removes cascade layers but keeps their rules in order', async () => {
    const css = await run('@layer base, utilities; @layer base { a { color: red } } @layer utilities { .p-1 { padding: 1px } }')

    expect(css).not.toContain('@layer')
    expect(css.indexOf(`${scope} a`)).toBeLessThan(css.indexOf(`${scope} .p-1`))
  })

  test('prefixes keyframes and the animations that use them', async () => {
    const css = await run('@keyframes spin { to { rotate: 1turn } } .animate-spin { animation: spin 1s linear infinite } .x { --animate-spin: spin 1s }')

    expect(css).toContain('@keyframes tasks-table-spin { to { rotate: 1turn } }')
    expect(css).toContain('animation: tasks-table-spin 1s linear infinite')
    expect(css).toContain('--animate-spin: tasks-table-spin 1s')
  })
})
