// Takes the README screenshot, `docs/screenshot.png`, from a demo vault in a
// separate Obsidian: `npm run screenshot`.
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createDemoVault } from './fixtureVault.mjs'
import { launchObsidian } from './obsidian.mjs'

const outputPath = path.resolve(import.meta.dirname, '..', 'docs', 'screenshot.png')

const vaultPath = await mkdtemp(path.join(tmpdir(), 'tasks-table-demo-'))
await createDemoVault(vaultPath)
const obsidian = await launchObsidian({ vaultPath })
const { page } = obsidian

try {
  // A sharp image on high-density screens, wide enough for the default columns.
  const session = await page.context().newCDPSession(page)
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: 1360,
    height: 860,
    deviceScaleFactor: 2,
    mobile: false,
  })

  // The table is the only tab, and the sidebars are closed.
  await page.evaluate(async () => {
    await window.app.commands.executeCommandById('tasks-table:open-table')
    window.app.workspace.iterateRootLeaves((leaf) => {
      if (leaf.view.getViewType() !== 'tasks-table') {
        leaf.detach()
      }
    })
    window.app.workspace.leftSplit.collapse()
    window.app.workspace.rightSplit.collapse()
  })
  const root = page.locator('.tasks-table-mount')
  await root.getByText(/\d+ results?/u).first().waitFor({ timeout: 15000 })
  await root.locator('tbody tr').nth(5).waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.mouse.move(0, 0)
  await page.waitForTimeout(500)

  await mkdir(path.dirname(outputPath), { recursive: true })
  await page.screenshot({ path: outputPath })
  console.log(`Screenshot: ${outputPath}`)
} finally {
  await obsidian.close()
  await rm(vaultPath, { recursive: true, force: true })
}
