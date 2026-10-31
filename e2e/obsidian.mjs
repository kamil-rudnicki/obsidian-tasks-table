import { spawn } from 'node:child_process'
import { copyFile, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright-core'

const obsidianPath = process.env.OBSIDIAN_PATH ?? '/Applications/Obsidian.app/Contents/MacOS/Obsidian'

// Obsidian installs app updates as `obsidian-<version>.asar` in its profile.
// Copying the newest one makes the test profile run the version in daily use.
const defaultProfilePath = process.env.OBSIDIAN_PROFILE_PATH ?? path.join(homedir(), 'Library/Application Support/obsidian')

const copyAppUpdate = async (userDataDir) => {
  const files = await readdir(defaultProfilePath).catch(() => [])
  const updates = files.filter((file) => /^obsidian-[\d.]+\.asar$/u.test(file))
  for (const file of updates) {
    await copyFile(path.join(defaultProfilePath, file), path.join(userDataDir, file))
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const connect = async (port) => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      return await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
    } catch {
      await delay(500)
    }
  }
  throw new Error('Obsidian did not open its debugging port.')
}

const findWorkspacePage = async (browser) => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    for (const context of browser.contexts()) {
      for (const page of context.pages()) {
        if (await page.evaluate(() => typeof window.app?.workspace === 'object').catch(() => false)) {
          return page
        }
      }
    }
    await delay(500)
  }
  throw new Error('The Obsidian workspace did not load.')
}

// Obsidian 1.15 opens settings in a pop-out window and tracks the window in
// focus as `activeWindow`. Synthetic input never sends the main window a focus
// event, so it is sent here; otherwise hotkeys look up the closed window.
export const closeSettings = async (page) => {
  await page.evaluate(() => {
    window.app.setting.close()
    window.dispatchEvent(new FocusEvent('focus'))
  })
  await page.bringToFront()
}

// Starts a separate Obsidian with its own profile, so the everyday Obsidian
// and its vaults stay untouched, and opens `vaultPath` in it.
export const launchObsidian = async ({ vaultPath, port = 9300 + Math.floor(Math.random() * 500) }) => {
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'tasks-table-obsidian-'))
  await writeFile(
    path.join(userDataDir, 'obsidian.json'),
    JSON.stringify({ vaults: { e2e: { path: vaultPath, ts: Date.now(), open: true } } }),
  )
  await copyAppUpdate(userDataDir)

  const child = spawn(obsidianPath, [`--user-data-dir=${userDataDir}`, `--remote-debugging-port=${port}`], {
    stdio: 'ignore',
    detached: false,
  })
  const browser = await connect(port)
  const page = await findWorkspacePage(browser)

  // A new profile asks whether to trust the vault's plugins. Trusting loads
  // the plugin; it is enabled by hand only when that did not happen, because
  // loading it twice registers its view twice.
  await page
    .getByRole('button', { name: 'Trust author and enable plugins' })
    .click({ timeout: 5000 })
    .catch(() => undefined)
  await page
    .waitForFunction(() => Boolean(window.app.plugins.plugins['tasks-table']), null, { timeout: 5000 })
    .catch(async () => {
      await page.evaluate(async () => {
        await window.app.plugins.setEnable(true)
        await window.app.plugins.enablePluginAndSave('tasks-table')
      })
    })
  // Trusting also opens the community plugin settings, a moment later.
  await page.waitForFunction(() => window.app.setting.isOpen, null, { timeout: 5000 }).catch(() => undefined)
  await closeSettings(page)

  return {
    page,
    port,
    userDataDir,
    // Also removes the profile: it holds a copy of the app update, about 40 MB.
    close: async () => {
      await browser.close().catch(() => undefined)
      if (child.exitCode === null && child.signalCode === null) {
        const exited = new Promise((resolve) => child.once('exit', resolve))
        child.kill()
        await Promise.race([exited, delay(5000)])
      }
      await rm(userDataDir, { recursive: true, force: true, maxRetries: 3 })
    },
  }
}
