import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import esbuild from 'esbuild'
import postcss from 'postcss'
import tailwindcss from '@tailwindcss/postcss'
import { scopeCss } from './scopeCss.mjs'

const root = path.resolve(import.meta.dirname, '..')
const appCssPath = path.join(root, 'src/ui/styles/app.css')
const resetCssPath = path.join(root, 'src/ui/styles/obsidianReset.css')
const obsidianCssPath = path.join(root, 'src/ui/styles/obsidian.css')
const outputPath = path.join(root, 'styles.css')

const banner = `/*
THIS IS A GENERATED FILE. Edit src/ui/styles and run the build instead.
*/
`

// Compiles Tailwind for the React UI and scopes it to the plugin. The reset of
// Obsidian's element styles goes first; the few unscoped rules for Obsidian's
// own elements go last.
export const buildCss = async ({ minify }) => {
  const appCss = await readFile(appCssPath, 'utf8')
  // The optimizer also flattens nested rules, which the scoping step needs.
  const scoped = await postcss([
    tailwindcss({ base: root, optimize: { minify: false } }),
    scopeCss(),
  ]).process(appCss, { from: appCssPath, to: outputPath })
  const resetCss = await readFile(resetCssPath, 'utf8')
  const scopedReset = await postcss([scopeCss()]).process(resetCss, { from: resetCssPath })
  const obsidianCss = await readFile(obsidianCssPath, 'utf8')
  const css = `${scopedReset.css}\n${scoped.css}\n${obsidianCss}`
  const output = minify
    ? (await esbuild.transform(css, { loader: 'css', minify: true })).code
    : css

  await writeFile(outputPath, banner + output)
}
