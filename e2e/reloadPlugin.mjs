import { installPlugin } from './fixtureVault.mjs'

// Copies the current build into the vault and reloads the plugin.
export default async (page) => {
  const vaultPath = await page.evaluate(() => window.app.vault.adapter.getBasePath())
  await installPlugin(vaultPath)
  await page.evaluate(async () => {
    await window.app.plugins.disablePlugin('tasks-table')
    await window.app.plugins.enablePlugin('tasks-table')
  })
  await page.waitForSelector('.tasks-table-mount [data-slot=data-grid]', { timeout: 15000 }).catch(() => undefined)
  await page.waitForTimeout(800)
  return 'reloaded'
}
