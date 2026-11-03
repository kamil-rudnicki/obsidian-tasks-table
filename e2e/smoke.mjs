// End-to-end smoke test in a real Obsidian: `npm run test:e2e`.
// Builds nothing; run `npm run build` first. Uses a fixture vault in a temporary
// folder and a separate Obsidian profile, so no real vault is touched.
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createFixtureVault } from './fixtureVault.mjs'
import { launchObsidian } from './obsidian.mjs'

const vaultPath = await mkdtemp(path.join(tmpdir(), 'tasks-table-smoke-'))
await createFixtureVault(vaultPath)

const obsidian = await launchObsidian({ vaultPath })
const { page } = obsidian
// Obsidian's notices, such as its indexing progress, can cover the toolbar's
// right edge. They only inform, so clicks go through them.
await page.addStyleTag({ content: '.notice-container { pointer-events: none; }' })
// Every action here takes well under a second; a broken step fails after 5s, not Playwright's 30s.
page.setDefaultTimeout(5000)
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error' && message.text().includes('Tasks table')) {
    errors.push(message.text())
  }
})

const read = (notePath) => readFile(path.join(vaultPath, notePath), 'utf8').catch(() => null)
const lineWith = async (notePath, text) => (await read(notePath))?.split('\n').find((line) => line.includes(text))
const root = page.locator('.tasks-table-mount')
const results = []

// Adds a filter from the toolbar. The menu's search box narrows the list first,
// as the list scrolls once the vault has inline fields.
const addFilter = async (field, value) => {
  await root.getByRole('button', { name: 'Filter', exact: true }).click()
  await page.getByPlaceholder('Filter by…').fill(field)
  // Hovering opens the field's values; a click right after it would close them again.
  const fieldOption = page.getByRole('option', { name: field, exact: true })
  const valueOption = page.getByRole('option', { name: value, exact: true })
  await fieldOption.hover()
  await valueOption.waitFor({ timeout: 2000 }).catch(() => fieldOption.click())
  await valueOption.click()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
}

const step = async (name, run) => {
  try {
    await run()
    results.push({ name, ok: true })
    console.log(`✓ ${name}`)
  } catch (error) {
    results.push({ name, ok: false })
    console.log(`✗ ${name}\n  ${error instanceof Error ? error.message : String(error)}`)
    await page.screenshot({ path: path.join(vaultPath, `failure-${results.length}.png`) }).catch(() => undefined)
  }
}

const waitFor = async (check, message, timeout = 5000) => {
  const start = Date.now()
  for (;;) {
    const value = await check()
    if (value) {
      return value
    }
    if (Date.now() - start > timeout) {
      throw new Error(message)
    }
    await page.waitForTimeout(100)
  }
}

try {
  await page.setViewportSize({ width: 1400, height: 860 })

  await step('opens the table and indexes the vault', async () => {
    await page.evaluate(() => window.app.commands.executeCommandById('tasks-table:open-table'))
    await root.getByText(/\d[\d,]* results?/u).first().waitFor({ timeout: 15000 })
    await waitFor(async () => (await root.locator('tbody tr').count()) > 5, 'No task rows rendered.')
  })

  await step('completes a task with its checkbox', async () => {
    await root.getByRole('button', { name: /^Open/u }).click()
    await page.getByRole('menuitemradio', { name: 'All tasks' }).click()
    await root.getByRole('button', { name: 'Search' }).click()
    await page.getByRole('textbox', { name: 'Search tasks' }).fill('Review pricing')
    // The checkbox repeats the Status column, so it starts hidden. It stays on in
    // this view: later steps find cells by their position.
    await root.getByRole('button', { name: 'Properties' }).click()
    await page.getByRole('menuitemcheckbox', { name: 'Checkbox', exact: true }).click()
    await page.keyboard.press('Escape')
    await root.locator('tbody tr', { hasText: 'Review pricing page' }).getByRole('checkbox').click()
    const line = await waitFor(
      async () => {
        const current = await lineWith('Projects/Website.md', 'Review pricing page')
        return current?.startsWith('- [x]') ? current : null
      },
      'The task was not marked as done in the note.',
    )
    assert.match(line, /\[completion:: \d{4}-\d{2}-\d{2}\]/u)
  })

  await step('changes priority from the cell menu', async () => {
    await page.getByRole('textbox', { name: 'Search tasks' }).fill('Book dentist')
    await root.locator('tbody tr', { hasText: 'Book dentist' }).getByRole('button', { name: /^Priority/u }).click()
    await page.getByRole('menuitemradio', { name: 'Highest' }).click()
    await waitFor(
      async () => (await lineWith('Personal/Home.md', 'Book dentist'))?.includes('[priority:: highest]'),
      'The priority was not written.',
    )
  })

  await step('puts a task off for later, and undoes it with Mod+Z', async () => {
    await page.getByRole('textbox', { name: 'Search tasks' }).fill('Plan v2')
    const row = root.locator('tbody tr', { hasText: 'Plan v2' })
    await row.getByRole('button', { name: 'Status: To do' }).click()
    await page.getByRole('menuitemradio', { name: 'Later' }).click()
    await waitFor(
      async () => (await lineWith('Projects/Website.md', 'Plan v2'))?.startsWith('- [>] Plan v2'),
      'The task was not put off for later.',
    )
    // Mod+Z, with the table in focus, puts the line back as it was.
    await root.getByRole('grid').focus()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+KeyZ' : 'Control+KeyZ')
    await waitFor(
      async () => (await lineWith('Projects/Website.md', 'Plan v2'))?.startsWith('- [ ] Plan v2'),
      'Mod+Z did not undo the status change.',
    )
    await row.getByRole('button', { name: 'Status: To do' }).waitFor()
  })

  await step('adds and removes tags in the Tags cell', async () => {
    await page.getByRole('textbox', { name: 'Search tasks' }).fill('Book dentist')
    const row = root.locator('tbody tr', { hasText: 'Book dentist' })
    await row.getByRole('combobox', { name: 'Tags: #health' }).click()
    // Typed text becomes a valid tag; Enter adds it.
    await page.getByRole('combobox', { name: 'Search or add tags' }).fill('Dental care')
    await page.getByRole('option', { name: 'Add #Dental-care' }).waitFor()
    await page.keyboard.press('Enter')
    await page.getByRole('option', { name: '#home', exact: true }).click()
    await page.getByRole('button', { name: 'Remove #health' }).click()
    // The note is written once, when the editor closes.
    assert.match(await lineWith('Personal/Home.md', 'Book dentist'), /#health/u)
    await page.keyboard.press('Escape')
    await waitFor(
      async () => /^- \[ \] Book dentist #Dental-care #home \[due:: [\d-]+\]/u.test(await lineWith('Personal/Home.md', 'Book dentist')),
      'The tags were not written.',
    )
    assert.doesNotMatch(await lineWith('Personal/Home.md', 'Book dentist'), /#health/u)
    await row.getByRole('combobox', { name: 'Tags: #Dental-care, #home' }).waitFor()
    // From the empty field, the left arrow goes to the last tag, and Alt with
    // the left arrow moves it before the tag next to it.
    await row.getByRole('combobox', { name: 'Tags: #Dental-care, #home' }).click()
    await page.getByRole('combobox', { name: 'Search or add tags' }).press('ArrowLeft')
    await page.keyboard.press('Alt+ArrowLeft')
    await page.keyboard.press('Escape')
    await waitFor(
      async () => /^- \[ \] Book dentist #home #Dental-care \[due:: [\d-]+\]/u.test(await lineWith('Personal/Home.md', 'Book dentist')),
      'The new tag order was not written.',
    )
    await row.getByRole('combobox', { name: 'Tags: #home, #Dental-care' }).waitFor()
  })

  await step('edits a title inline', async () => {
    await page.getByRole('textbox', { name: 'Search tasks' }).fill('Call Ann')
    // One click on a title opens the inline editor.
    const row = root.locator('tbody tr', { hasText: 'Call Ann' })
    await row.locator('td').nth(1).click()
    const editor = root.locator('[data-slot=data-grid-cell-editor]')
    await editor.waitFor()
    // Long text wraps over the rows below while the row keeps its height, and
    // a line break becomes a space, as a task is one line.
    const rowHeight = (await row.boundingBox()).height
    await editor.fill(`Call Ann\n${'about the plans for the long weekend '.repeat(6)}`)
    assert.ok((await editor.boundingBox()).height > rowHeight * 2, 'The editor did not wrap the long title.')
    assert.equal((await row.boundingBox()).height, rowHeight)
    assert.doesNotMatch(await editor.inputValue(), /\n/u)
    await editor.fill('Call Ann about the trip #people')
    await page.keyboard.press('Enter')
    const yesterday = await page.evaluate(() => window.moment().subtract(1, 'day').format('YYYY-MM-DD'))
    await waitFor(
      async () => (await lineWith(`Daily/${yesterday}.md`, 'Call Ann'))?.includes('about the trip'),
      'The new title was not written.',
    )
  })

  await step('deletes a task after confirmation', async () => {
    await page.getByRole('textbox', { name: 'Search tasks' }).fill('Old redesign')
    await root.locator('tbody tr', { hasText: 'Old redesign idea' }).getByRole('button', { name: 'Task actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete task…' }).click()
    await page.getByRole('button', { name: 'Delete task' }).click()
    await waitFor(
      async () => (await lineWith('Projects/Website.md', 'Old redesign idea')) === undefined,
      'The task line is still in the note.',
    )
    await page.getByRole('button', { name: 'Clear search' }).click()
  })

  await step('cuts a task with its notes to the clipboard', async () => {
    // A stand-in for the clipboard, so a test run keeps the clipboard of the app in use.
    await page.evaluate(() => {
      Object.defineProperty(window.navigator.clipboard, 'writeText', {
        configurable: true,
        value: async (text) => {
          window.cutText = text
        },
      })
    })
    // Clear search in the step above closed the search field.
    await root.getByRole('button', { name: 'Search' }).click()
    await page.getByRole('textbox', { name: 'Search tasks' }).fill('Sort the receipts')
    await root.locator('tbody tr', { hasText: 'Sort the receipts' }).getByRole('button', { name: 'Task actions' }).click()
    await page.getByRole('menuitem', { name: 'Cut task' }).click()
    await waitFor(async () => !(await read('Notes/Inbox.md')).includes('Sort the receipts'), 'The task is still in its note.')
    assert.equal(await read('Notes/Inbox.md'), '# Inbox\n\n- [ ] Renew the passport\n')
    assert.equal(await page.evaluate(() => window.cutText), '- [ ] Sort the receipts\n  From the shoebox in the hall')
    await page.evaluate(() => delete window.navigator.clipboard.writeText)
    await page.getByRole('button', { name: 'Clear search' }).click()
  })

  await step('opens a task in a new ChatGPT or Claude desktop chat', async () => {
    // A stand-in for window.open, so the test opens no dialog and no app.
    await page.evaluate(() => {
      window.realOpen = window.open
      window.openedLinks = []
      window.open = (url) => {
        window.openedLinks.push(url)
        return null
      }
    })
    try {
      await root.getByRole('button', { name: 'Search' }).click()
      await page.getByRole('textbox', { name: 'Search tasks' }).fill('Write landing page copy')
      const actions = root.locator('tbody tr', { hasText: 'Write landing page copy' }).getByRole('button', { name: 'Task actions' })
      await actions.click()
      await page.getByRole('menuitem', { name: 'Run ChatGPT Desktop' }).click()
      await actions.click()
      await page.getByRole('menuitem', { name: 'Run Claude Desktop' }).click()
      const [chatGpt, claude] = (
        await waitFor(async () => {
          const links = await page.evaluate(() => window.openedLinks)
          return links.length === 2 ? links : null
        }, 'The chat links were not opened.')
      ).map((link) => new URL(link))
      const basePath = await page.evaluate(() => window.app.vault.adapter.getBasePath())
      const request = `Help me with this task ${await lineWith('Projects/Website.md', 'Write landing page copy')} ${path.join(basePath, 'Projects/Website.md')}.`
      // The prompt asks the agent to comment on the task that it is running,
      // with a link to its chat from the chat id in its environment.
      const checkPrompt = (prompt, chatLink, idVariable) => {
        assert.ok(prompt.startsWith(`${request}\n\nBefore you start, add this comment`), prompt)
        assert.match(prompt, /\[comment_\d{4}-\d{2}-\d{2} \d{2}:\d{2}:: Agent is running in /u)
        assert.ok(prompt.includes(`${chatLink}], with {id} replaced by the value of the ${idVariable} environment variable`), prompt)
      }
      // Without a folder in the settings, the chat works in the vault folder.
      assert.equal(`${chatGpt.protocol}//${chatGpt.host}${chatGpt.pathname}`, 'codex://threads/new')
      assert.equal(chatGpt.searchParams.get('path'), basePath)
      checkPrompt(chatGpt.searchParams.get('prompt'), 'codex://threads/{id}', 'CODEX_THREAD_ID')
      assert.equal(`${claude.protocol}//${claude.host}${claude.pathname}`, 'claude://code/new')
      assert.equal(claude.searchParams.get('folder'), basePath)
      checkPrompt(claude.searchParams.get('q'), 'claude://code/continue?session={id}', 'CLAUDE_CODE_HOST_SESSION_ID')
    } finally {
      await page.evaluate(() => {
        window.open = window.realOpen
        delete window.realOpen
      })
    }
    await page.getByRole('button', { name: 'Clear search' }).click()
  })

  await step('adds a comment and keeps it when the title changes', async () => {
    await root.getByRole('button', { name: 'Search' }).click()
    await page.getByRole('textbox', { name: 'Search tasks' }).fill('Renew the passport')
    const row = root.locator('tbody tr', { hasText: 'Renew the passport' })
    await row.getByRole('button', { name: 'Add a comment' }).click()
    // The field has the focus; Enter adds the comment with the current time.
    await page.getByRole('textbox', { name: 'Comment', exact: true }).fill('Book the photo [first]')
    await page.keyboard.press('Enter')
    const line = await waitFor(
      async () => {
        const current = await lineWith('Notes/Inbox.md', 'Renew the passport')
        return current?.includes('[comment_') ? current : null
      },
      'The comment was not written.',
    )
    assert.match(line, /^- \[ \] Renew the passport \[comment_\d{4}-\d{2}-\d{2} \d{2}:\d{2}:: Book the photo \[first\]\]$/u)
    await page.getByRole('list', { name: 'Comments' }).getByText('Book the photo [first]').waitFor()
    // A link back to an agent's chat shows as the app, ready to open.
    await page.getByRole('textbox', { name: 'Comment', exact: true }).fill('Agent is running in codex://threads/01a1a0f1-5cbe')
    await page.keyboard.press('Enter')
    const chatLink = page.getByRole('list', { name: 'Comments' }).getByRole('link', { name: 'ChatGPT' })
    await chatLink.waitFor()
    assert.equal(await chatLink.getAttribute('href'), 'codex://threads/01a1a0f1-5cbe')
    await page.keyboard.press('Escape')
    await row.getByRole('button', { name: '2 comments' }).waitFor()
    // The title editor shows the title without the comment, and a new title keeps it.
    await row.locator('td[data-col-id=description]').click()
    const editor = root.locator('[data-slot=data-grid-cell-editor]')
    await editor.waitFor()
    assert.equal(await editor.inputValue(), 'Renew the passport')
    await editor.fill('Renew the passport early')
    await page.keyboard.press('Enter')
    await waitFor(
      async () => (await lineWith('Notes/Inbox.md', 'Renew the passport early'))?.includes(':: Book the photo [first]]'),
      'The new title did not keep the comment.',
    )
    await page.getByRole('button', { name: 'Clear search' }).click()
  })

  await step('adds a task to today’s daily note with Mod+N', async () => {
    // Focus the table without opening an editor, then press the shortcut.
    await root.getByRole('grid').focus()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+KeyN' : 'Control+KeyN')
    const input = page.getByRole('textbox', { name: 'New task' })
    await input.waitFor({ timeout: 3000 }).catch(async (error) => {
      const state = await page.evaluate(() => ({
        activeLeaf: window.app.workspace.activeLeaf?.view.getViewType(),
        activeElement: `${document.activeElement?.tagName} ${document.activeElement?.className}`.slice(0, 120),
        hasFocus: document.hasFocus(),
        activeWindowIsMain: window.activeWindow === window,
      }))
      throw new Error(`${error.message}\n  ${JSON.stringify(state)}`)
    })
    await input.fill('Buy milk #home')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Escape')
    const today = await page.evaluate(() => window.moment().format('YYYY-MM-DD'))
    const line = await waitFor(() => lineWith(`Daily/${today}.md`, 'Buy milk'), 'The daily note has no new task.')
    assert.match(line, /^- \[ \] Buy milk #home \[created:: \d{4}-\d{2}-\d{2}\]$/u)
  })

  await step('filters tasks from daily notes', async () => {
    const filterDailyNote = (day) => addFilter('Daily note', day)
    // Yesterday's note holds "Call Ann" and "Gym"; the step above created today's note.
    await filterDailyNote('Any day')
    await root.getByText('3 results').waitFor()
    await root.getByRole('button', { name: 'Remove filter' }).click()
    await filterDailyNote('Today')
    await root.getByText('1 result', { exact: true }).waitFor()
    assert.equal(await root.locator('tbody tr', { hasText: 'Buy milk' }).count(), 1)
    // A day picked from the calendar. Opened from the keyboard, the calendar
    // focuses today, so the left arrow moves to yesterday.
    // The Filter menu gives the focus back to its button as it closes, so the
    // keys wait until it is gone and the value menu has the focus.
    await page.locator('[data-slot=dropdown-menu-content]').waitFor({ state: 'detached' })
    await root.getByRole('button', { name: 'Daily note: Today' }).focus()
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => document.activeElement?.closest('[data-slot=dropdown-menu-content]'))
    await page.keyboard.press('End')
    await page.waitForFunction(() => document.activeElement?.textContent === 'Pick a date…')
    await page.keyboard.press('Enter')
    await page.locator('[data-slot=popover-content][data-open] [role=grid]').waitFor()
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('Enter')
    await root.getByText('2 results', { exact: true }).waitFor()
    const yesterday = await page.evaluate(() => window.moment().subtract(1, 'day').format('YYYY-MM-DD'))
    await waitFor(
      async () =>
        (await page.evaluate(async () => {
          const views = await window.app.plugins.plugins['tasks-table'].services.invoke('views:list', null)
          return views.find((view) => view.name === 'All tasks').config.filters.flatMap((filter) => filter.values).join()
        })) === yesterday,
      'The view did not save the picked day.',
    )
    await root.getByRole('button', { name: 'Remove filter' }).click()
  })

  await step('filters first-level tasks and subtasks', async () => {
    const resultCount = async () =>
      Number((await root.getByText(/^\d[\d,]* results?$/u).first().textContent()).replace(/\D/gu, ''))
    // From the index: the count on screen can still show the previous step's filter.
    const allCount = await page.evaluate(
      async () =>
        (
          await window.app.plugins.plugins['tasks-table'].services.invoke('tasks:list', {
            filters: [],
            sorting: [],
            search: '',
          })
        ).length,
    )
    // "Book venue" is the only subtask in the fixture vault.
    await addFilter('Level', 'Subtask')
    await root.getByText('1 result', { exact: true }).waitFor()
    assert.equal(await root.locator('tbody tr', { hasText: 'Book venue' }).count(), 1)
    await root.getByRole('button', { name: 'Remove filter' }).click()
    await addFilter('Level', 'First level')
    await waitFor(async () => (await resultCount()) === allCount - 1, 'First level did not leave out the subtask.')
    await root.getByRole('button', { name: 'Remove filter' }).click()
  })

  await step('shows edits made in notes', async () => {
    // Mod+F opens the search field and focuses it.
    await root.getByRole('grid').focus()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+KeyF' : 'Control+KeyF')
    await waitFor(
      () => page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Search tasks'),
      'Mod+F did not focus the search field.',
    )
    await page.getByRole('textbox', { name: 'Search tasks' }).fill('Pay rent')
    // Typing in Obsidian's editor reaches the table once Obsidian saves the note.
    await page.evaluate(async () => {
      const leaf = window.app.workspace.getLeaf('split')
      await leaf.openFile(window.app.vault.getAbstractFileByPath('Personal/Home.md'))
      const { editor } = leaf.view
      const line = editor.getValue().split('\n').findIndex((text) => text.includes('Pay rent'))
      editor.replaceRange(' today', { line, ch: editor.getLine(line).indexOf('Pay rent') + 'Pay rent'.length })
    })
    await root.getByText('Pay rent today').waitFor({ timeout: 10000 })
    // A change from outside Obsidian, such as sync, arrives through the file watcher.
    // It is written only after Obsidian saved the edit above, so the two do not race.
    await waitFor(async () => (await read('Personal/Home.md'))?.includes('Pay rent today'), 'Obsidian did not save.')
    const file = path.join(vaultPath, 'Personal/Home.md')
    await writeFile(file, (await readFile(file, 'utf8')).replace('Pay rent today', 'Pay rent tomorrow'))
    await root.getByText('Pay rent tomorrow').waitFor({ timeout: 5000 })
    await page.getByRole('button', { name: 'Clear search' }).click()
  })

  await step('moves a task to the daily note of its new start date', async () => {
    await root.getByRole('button', { name: 'Properties' }).click()
    await page.getByRole('menuitemcheckbox', { name: 'Start' }).click()
    await page.keyboard.press('Escape')
    await root.getByRole('button', { name: 'Search' }).click()
    await page.getByRole('textbox', { name: 'Search tasks' }).fill('Prepare offsite')
    await root.locator('tbody tr', { hasText: 'Prepare offsite agenda' }).getByRole('button', { name: /start date/u }).click()
    await page.getByRole('button', { name: 'Tomorrow' }).click()
    const tomorrow = await page.evaluate(() => window.moment().add(1, 'day').format('YYYY-MM-DD'))
    // The daily note did not exist: it is created from the template, and the task
    // with its subtask goes after the last line with content, as new tasks do.
    const note = await waitFor(() => read(`Daily/${tomorrow}.md`), 'The daily note was not created.')
    assert.equal(note, `# ${tomorrow}\n- [ ] Prepare offsite agenda #work [start:: ${tomorrow}]\n\t- [ ] Book venue\n\n`)
    // The task is added to the daily note first and removed from its note after that.
    await waitFor(async () => {
      const source = await read('Projects/Website.md')
      return !source.includes('Prepare offsite agenda') && !source.includes('Book venue')
    }, 'The task is still in its old note.')
    await root.locator('tbody tr', { hasText: 'Prepare offsite agenda' }).getByText(tomorrow).waitFor()
    await page.getByRole('button', { name: 'Clear search' }).click()
    // Hide the column again, so the next steps see the table as before.
    await root.getByRole('button', { name: 'Properties' }).click()
    await page.getByRole('menuitemcheckbox', { name: 'Start' }).click()
    await page.keyboard.press('Escape')
    await root.locator('[data-slot=scroll-area-viewport]').first().evaluate((viewport) => {
      viewport.scrollLeft = 0
    })
  })

  await step('sorts by tags', async () => {
    const firstRowTags = () => root.locator('tbody tr').first().locator('td').nth(5).textContent()
    await root.locator('thead').getByRole('button', { name: /Tags/u }).click()
    await page.getByRole('menuitem', { name: 'Sort ascending' }).click()
    await waitFor(async () => (await firstRowTags())?.startsWith('#bulk/0'), 'Tags did not sort A to Z.')
    await root.locator('thead').getByRole('button', { name: /Tags/u }).click()
    await page.getByRole('menuitem', { name: 'Sort descending' }).click()
    await waitFor(async () => (await firstRowTags()) === '#work/marketing', 'Tags did not sort Z to A.')
    await root.getByRole('button', { name: 'Sort', exact: true }).click()
    await page.getByRole('button', { name: 'Remove sort by Tags' }).click()
    await page.keyboard.press('Escape')
  })

  await step('shows inline fields as properties and filters', async () => {
    const toggleProperties = async () => {
      await root.getByRole('button', { name: 'Properties' }).click()
      await page.getByRole('menuitemcheckbox', { name: 'type', exact: true }).click()
      await page.getByRole('menuitemcheckbox', { name: 'person', exact: true }).click()
      await page.keyboard.press('Escape')
    }
    await toggleProperties()
    await root.locator('thead').getByText('type', { exact: true }).waitFor()
    await root.getByRole('button', { name: 'Search' }).click()
    await page.getByRole('textbox', { name: 'Search tasks' }).fill('Fix bike')
    const row = root.locator('tbody tr', { hasText: 'Fix bike' })
    await row.getByText('home', { exact: true }).waitFor()
    // Links in values read as in the note.
    await row.getByText('Ann', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Clear search' }).click()

    await addFilter('type', 'work')
    await root.getByText('1 result', { exact: true }).waitFor()
    assert.equal(await root.locator('tbody tr', { hasText: 'Draft budget' }).count(), 1)
    await root.getByRole('button', { name: 'Remove filter' }).click()
    await toggleProperties()
  })

  await step('groups tasks in two levels and closes a group', async () => {
    const groupHeaders = root.locator('[data-slot=data-grid-group-row]')
    const groupName = (index) => groupHeaders.nth(index).getByRole('button')
    const savedGrouping = () =>
      page.evaluate(async () => {
        const views = await window.app.plugins.plugins['tasks-table'].services.invoke('views:list', null)
        const { grouping, collapsedGroups } = views.find((view) => view.name === 'All tasks').config
        return `${grouping.map((level) => level.field).join()} ${collapsedGroups.join()}`
      })
    // An open, empty search field closes only after a press on Group is over,
    // so the button stays under the pointer: a press as long as a person's opens it.
    const search = page.getByRole('textbox', { name: 'Search tasks' })
    if (!(await search.count())) {
      await root.getByRole('button', { name: 'Search' }).click()
    }
    await search.fill('')
    await root.getByRole('button', { name: 'Group', exact: true }).click({ delay: 80 })
    await page.getByRole('combobox', { name: 'Group property' }).click()
    await page.getByRole('option', { name: 'Status', exact: true }).click()
    await page.keyboard.press('Escape')
    await groupHeaders.first().waitFor()
    assert.match(await groupHeaders.first().textContent(), /^StatusIn progress\d+$/u)
    // Only the name opens and closes a group, not the rest of its header.
    await groupHeaders.first().click({ position: { x: 600, y: 18 } })
    assert.equal(await groupName(0).getAttribute('aria-expanded'), 'true')
    // A closed group hides its tasks, so the next group's header follows it.
    await groupName(0).click()
    await waitFor(
      async () => (await groupHeaders.nth(1).textContent())?.startsWith('StatusTo do'),
      'The group did not close.',
    )
    assert.equal(await groupName(0).getAttribute('aria-expanded'), 'false')
    await waitFor(async () => (await savedGrouping()) === 'status group:in_progress', 'The view did not save the group.')
    // A second level groups each group again; the closed group stays closed.
    await root.getByRole('button', { name: 'Group', exact: true }).click()
    await page.getByRole('button', { name: 'Add subgroup' }).click()
    await page.keyboard.press('Escape')
    await waitFor(
      async () => (await groupHeaders.nth(2).textContent())?.startsWith('PriorityHigh'),
      'The groups were not grouped by priority.',
    )
    assert.match(await groupHeaders.nth(1).textContent(), /^StatusTo do\d+$/u)
    await waitFor(
      async () => (await savedGrouping()) === 'status,priority group:in_progress',
      'The view did not save the second level.',
    )
    await root.getByRole('button', { name: 'Group', exact: true }).click()
    await page.getByRole('button', { name: 'Remove group by Priority' }).click()
    await page.getByRole('button', { name: 'Remove group by Status' }).click()
    await page.keyboard.press('Escape')
    await waitFor(async () => (await groupHeaders.count()) === 0, 'The groups did not go away.')
    await waitFor(async () => (await savedGrouping()) === ' ', 'The view did not save the removal.')
  })

  await step('adds a filter and a sort', async () => {
    await addFilter('Status', 'Done')
    await waitFor(async () => (await root.getByText('Done', { exact: true }).count()) > 0, 'No done tasks shown.')
    await root.getByRole('button', { name: 'Sort', exact: true }).click()
    await page.getByRole('button', { name: 'Add sort' }).click()
    await page.keyboard.press('Escape')
  })

  await step('switches a filter between is and is any of', async () => {
    const statusFilter = () =>
      page.evaluate(async () => {
        const views = await window.app.plugins.plugins['tasks-table'].services.invoke('views:list', null)
        // Views save a moment after the last change; until then there may be no filter.
        const filter = views.find((view) => view.name === 'All tasks').config.filters[0]
        return filter ? `${filter.operator} ${filter.values.join()}` : null
      })
    await root.getByRole('button', { name: 'is', exact: true }).click()
    // The operator menu only; another menu may still be closing.
    const operators = page
      .getByRole('menu')
      .filter({ has: page.getByRole('menuitem', { name: 'is not any of' }) })
      .getByRole('menuitem')
    await operators.last().waitFor()
    assert.deepEqual(await operators.allTextContents(), ['is', 'is not', 'is any of', 'is not any of'])
    // Each label stays on one line.
    const heights = await operators.evaluateAll((items) =>
      items.map((item) => Math.round(item.getBoundingClientRect().height)),
    )
    assert.equal(new Set(heights).size, 1, `Operator rows have different heights: ${heights.join()}`)
    await page.getByRole('menuitem', { name: 'is any of', exact: true }).click()
    // The filter chip's value; status cells in the table have the same name.
    await root.locator('[data-slot=button-group]').getByRole('button', { name: 'Status: Done' }).click()
    await page.getByRole('option', { name: 'Cancelled' }).click()
    await page.keyboard.press('Escape')
    await waitFor(async () => (await statusFilter()) === 'is_any_of done,cancelled', 'Is any of did not keep two values.')
    await root.getByRole('button', { name: 'is any of', exact: true }).click()
    await page.getByRole('menuitem', { name: 'is', exact: true }).click()
    await waitFor(async () => (await statusFilter()) === 'is done', 'Is did not keep only the first value.')
  })

  await step('saves view changes on its own', async () => {
    // Earlier steps can leave the table scrolled sideways, with the Task column's edge out of view.
    await root.locator('[data-slot=scroll-area-viewport]').first().evaluate((viewport) => {
      viewport.scrollLeft = 0
    })
    await root.getByRole('button', { name: 'Properties' }).click()
    await page.getByRole('menuitemcheckbox', { name: 'Folder' }).click()
    await page.keyboard.press('Escape')
    const handle = root.locator('thead th').nth(1).locator('[data-slot=data-grid-table-resize-handle]')
    const box = await handle.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 - 100, box.y + box.height / 2, { steps: 10 })
    await page.mouse.up()
    await root.locator('thead').getByRole('button', { name: /Status/u }).click()
    await page.getByRole('menuitem', { name: 'Move to right' }).click()
    await page.keyboard.press('Escape')
    // No save step: after a reload the view comes back from the database as it was left.
    await page.waitForTimeout(1500)
    await page.evaluate(async () => {
      await window.app.plugins.disablePlugin('tasks-table')
      await window.app.plugins.enablePlugin('tasks-table')
    })
    const { config } = await page.evaluate(async () =>
      (await window.app.plugins.plugins['tasks-table'].services.invoke('views:list', null)).find(
        (view) => view.name === 'All tasks',
      ),
    )
    assert.deepEqual(
      config.filters.map((filter) => `${filter.field} ${filter.values.join()}`),
      ['status done'],
    )
    assert.equal(config.sorting.length, 1)
    assert.notEqual(config.columnVisibility.folder, false)
    assert.equal(config.columnSizing.description, 320)
    assert.ok(config.columnOrder.indexOf('status') > config.columnOrder.indexOf('priority'))
  })

  await step('keeps a new view after the plugin reloads', async () => {
    await root.getByRole('button', { name: /^All tasks/u }).click()
    await page.getByRole('menuitem', { name: 'Duplicate view…' }).click()
    await page.getByRole('textbox', { name: 'Name' }).fill('Smoke view')
    await page.getByRole('button', { name: 'Duplicate view' }).click()
    await root.getByRole('button', { name: /^Smoke view/u }).waitFor()
    await page.waitForTimeout(800)
    await page.evaluate(async () => {
      await window.app.plugins.disablePlugin('tasks-table')
      await window.app.plugins.enablePlugin('tasks-table')
    })
    await root.getByRole('button', { name: /^Smoke view/u }).waitFor({ timeout: 10000 })
    assert.ok(existsSync(path.join(vaultPath, '.obsidian/plugins/tasks-table/tasks-table.sqlite')))
  })

  await step('shows the settings tab', async () => {
    // Rendered in the main window: Obsidian 1.15 shows its settings in a window
    // of its own, which would take the focus from the app in use.
    const readTab = () =>
      page.evaluate(() => {
        const tab = window.app.setting.pluginTabs.find((candidate) => candidate.id === 'tasks-table')
        if (!tab.containerEl.hasChildNodes()) {
          tab.display()
        }
        return tab.containerEl.textContent
      })
    await waitFor(
      async () => {
        const text = await readTab()
        return text.includes('Write dates and priority as') && /\d[\d,]* tasks in \d+ notes/u.test(text)
      },
      'The settings tab did not show its settings and the index status.',
    )
    await page.evaluate(() => window.app.setting.pluginTabs.find((tab) => tab.id === 'tasks-table').hide())
  })

  await step('logs no errors', () => {
    assert.deepEqual(errors, [], `Errors: ${errors.join(' | ')}`)
  })
} finally {
  await obsidian.close()
}

const failed = results.filter((result) => !result.ok)
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed.`)
// A failed run keeps the vault with its screenshots for a look; a passed run removes it.
if (failed.length > 0) {
  console.log(`Vault and screenshots: ${vaultPath}`)
  process.exitCode = 1
} else {
  await rm(vaultPath, { recursive: true, force: true })
}
