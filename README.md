# Tasks Table

Tasks Table shows the tasks from every note in your vault in one table, in the style of Obsidian Bases. Tasks stay in their notes; the table reads them and writes your edits back to the Markdown.

## What it does

- Indexes `- [ ]` tasks in every note, also in callouts and numbered lists. Fenced code and front matter are skipped.
- Reads the Obsidian Tasks emoji format (`📅 2026-11-02`, `⏫`) and the Dataview format (`[due:: 2026-11-02]`, `[priority:: high]`).
- Saved views with filters, sorting, visible properties, column order and widths. Views save as you change them, like Bases.
- **Sort**: several sort rules, reordered by dragging. Tags sort by the first tag, then the next ones; numbers in fields sort as numbers.
- **Filter**: status, priority, dates (overdue, today, next 7 days and more), tags (nested tags match), note, folder and daily note (tasks from any daily note, or from today's, yesterday's or the last 7 days' notes). Daily notes are the notes in the Daily notes folder whose names match its date format. **Level** keeps first-level tasks or subtasks, which are tasks inside another list item (a task or a bullet).
- **Properties**: show, hide, move and resize columns.
- Dataview inline fields: every `[key:: value]` in your tasks, such as `[projekt:: Website]` or `[estimate:: 3]`, is a property you can show as a column, filter by (is, is not, is empty, is not empty, with the values your tasks use) and sort by. Field columns start hidden. Fields with columns of their own (`due`, `scheduled`, `start`, `created`, `completion`, `cancelled`, `priority`) stay in those columns, and `(key:: value)` fields, which Dataview shows without their key, are not included.
- **Search** across task text and note names.
- **New** (or <kbd>Mod</kbd>+<kbd>N</kbd> while the table has focus) adds a task to today's daily note or to a note you choose.
- Edit in place: complete a task with its checkbox; change status, priority and dates from their cells; select a title to edit it; delete a task from the row menu.
- Tags: each tag has its own color, one of the theme's accent colors, picked from its name. Select a Tags cell to add or remove tags: search the vault's tags (listed by name), or type a new name and press <kbd>Enter</kbd> (spaces become dashes). The note changes once, when you close the editor. New tags go after the task text, before its dates and fields; removed tags are taken out wherever they are in the text.
- Changing a start date moves the task, with its subtasks and notes, to that day's daily note. The daily note is created from the Daily notes template when it does not exist. The task is added there first and removed from its old note after that, so a failed write never loses it.
- Select a note name to open the note at the task's line. <kbd>Mod</kbd>-select opens it to the right.
- Follows the Obsidian theme: colors, accent, fonts and light or dark mode.

Open the table with the ribbon icon or the **Tasks Table: Open table** command. The plugin also adds **Add task** and **Rebuild task index** commands.

## Settings

**Settings → Tasks Table**:

- **Add new tasks to**: today's daily note (uses the folder, date format and template of the Daily notes core plugin) or a specific note, optionally under a heading.
- **Write dates and priority as**: Tasks emoji or Dataview. On the first start the plugin uses the format of the Obsidian Tasks plugin, if you have it.
- **Add completion dates** and **Add created dates**.
- **Move tasks to the daily note of their start date** (on by default). Moved tasks go under the **Under heading** section of the daily note.
- **Task index**: the number of indexed tasks and a **Rebuild index** button.

## Data

- Settings and views are stored in an SQLite database, `tasks-table.sqlite`, in the plugin folder (`<vault>/.obsidian/plugins/tasks-table/`). It has a `settings` table with one `name`/`value` row per setting and a `views` table. It syncs with the rest of the vault's configuration.
- Tasks are not stored. The plugin builds an in-memory index from the notes when Obsidian starts and keeps it current from Obsidian's file events. Like the Tasks plugin, it uses Obsidian's metadata cache to skip notes without tasks. On a vault with 3,000 notes and 15,000 tasks, indexing takes about 0.4 seconds.
- The plugin works offline. It makes no network requests and sends no data anywhere.

Requires Obsidian 1.13 or later, on desktop and mobile.

## Development

```bash
npm install
npm run dev        # rebuild main.js and styles.css on every change
npm run build      # type check and production build
npm test           # unit tests (Vitest)
npm run lint       # ESLint with the Obsidian rules
npm run test:e2e   # build, then drive a real Obsidian through the main flows
```

`npm run test:e2e` starts a separate Obsidian (`/Applications/Obsidian.app` by default, override with `OBSIDIAN_PATH`) with a temporary profile and a generated fixture vault, so it never touches your own vaults. It copies the newest Obsidian app update from your profile, so the test runs the Obsidian version you use. It runs in the background: on macOS it starts Obsidian with `open -g`, and when Obsidian still takes the focus as it shows its window at start (Electron activates the app for each window it shows), it gives the focus back to the app you use within a moment. `npm run e2e:open` opens such an instance with a fixture vault and keeps it running (pass a vault path to use a copy of a vault instead; the plugin is installed into it; set `E2E_FOCUS=1` to work in it by hand); `PORT=9333 node e2e/cdp.mjs script.mjs` runs a Playwright script against it.

To try the plugin in a vault, copy or link `main.js`, `manifest.json` and `styles.css` to `<vault>/.obsidian/plugins/tasks-table/`.

### How it is built

- `src/main.ts`: plugin lifecycle, commands and the view.
- `src/plugin/`: the composition root (`PluginServices`), the API the UI calls, the item view and the settings tab (Obsidian's declarative settings).
- `src/database/`: sql.js (SQLite compiled to WebAssembly, bundled into `main.js`), migrations, and the settings and views repositories.
- `src/vault/`: task line syntax (`taskLineSyntax.ts`) and editing (`taskLine.ts`), the in-memory task index with its filters and sorting, the vault indexer and the writer that edits notes with `Vault.process`.
- `src/ui/`: the React UI with shadcn/ui (Base UI) and ReUI's data grid and filters, TanStack Table, Query and Store.

The UI uses Tailwind CSS. Obsidian loads `styles.css` into the whole app, so `scripts/scopeCss.mjs` scopes every rule to the plugin's elements, removes cascade layers and prefixes keyframes, and `src/ui/styles/obsidianReset.css` drops Obsidian's global button and input styles inside the plugin. The design tokens in `src/ui/styles/app.css` map to Obsidian's CSS variables. `src/ui/components/ui` and `src/ui/components/reui` are generated by the shadcn and ReUI registries; keep changes to them minimal.

## Releasing

Bump `version` in `manifest.json` and `versions.json`, then create a GitHub release whose tag is the version. The release workflow builds and attaches `main.js`, `manifest.json` and `styles.css`.
