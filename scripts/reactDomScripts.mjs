// Removes React DOM's script loading from the bundle.
//
// React DOM adds <script> elements to the page for `ReactDOM.preinit()` and
// `preinitModule()`, and for a `<script async src>` rendered as a hoisted
// resource. The plugin uses none of these, so the build replaces the three
// places that create the elements with an error: main.js then holds no code
// that loads scripts. A React DOM update that changes this code fails the
// build, so the change gets a look.
import { readFile } from 'node:fs/promises'

// esbuild runs filters as Go regular expressions, which take no flags.
const reactDomClientPattern = /[\\/]react-dom[\\/]cjs[\\/]react-dom-client\.(?:production|development)\.js$/
const scriptCreationPattern = /\b[\w$]+\.createElement\("script"\)/gu
const expectedScriptCreations = 3
const removedScriptLoading =
  '(() => { throw new Error("Tasks Table: React DOM script loading is removed from this build.") })()'

export const reactDomScriptsPlugin = {
  name: 'tasks-table-react-dom-scripts',
  setup(build) {
    build.onLoad({ filter: reactDomClientPattern }, async ({ path }) => {
      const source = await readFile(path, 'utf8')
      const found = source.match(scriptCreationPattern)?.length ?? 0
      if (found !== expectedScriptCreations) {
        throw new Error(
          `${path} creates script elements in ${found} places, not ${expectedScriptCreations}. Check scripts/reactDomScripts.mjs against this React DOM version.`,
        )
      }
      return { contents: source.replace(scriptCreationPattern, removedScriptLoading), loader: 'js' }
    })
  },
}
