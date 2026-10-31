import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// Tests read the sql.js WebAssembly file that esbuild embeds in the plugin bundle.
const require = createRequire(import.meta.url)

export default new Uint8Array(readFileSync(require.resolve('sql.js/dist/sql-wasm-browser.wasm')))
