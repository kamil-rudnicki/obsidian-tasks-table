import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { copyFile, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright-core'
import { installPlugin } from './fixtureVault.mjs'

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

// Chromium slows down windows in the background. A test Obsidian stays behind
// the app in use, so its timers and animations must still run at full speed.
const backgroundSwitches = [
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
]

// On macOS, `open -g` starts Obsidian without bringing it to the front, so a
// test run does not take the keyboard focus from the app in use.
const startObsidian = (args) => {
  const appBundle = /^(.+\.app)\/Contents\/MacOS\//u.exec(obsidianPath)?.[1]
  return process.platform === 'darwin' && appBundle
    ? spawn('open', ['-g', '-n', '-a', appBundle, '--args', ...args], { stdio: 'ignore' })
    : spawn(obsidianPath, args, { stdio: 'ignore' })
}

// Runs a command and gives its output, or '' when it fails.
const run = (command, args) =>
  new Promise((resolve) => execFile(command, args, (error, stdout) => resolve(error ? '' : stdout)))

// `--` keeps a pattern from being read as an option.
const isRunning = async (pattern) => (await run('pgrep', ['-f', '--', pattern])) !== ''

// Obsidian is not a child process when `open` starts it. The name of its
// profile folder, which is unique to the run, finds all of its processes.
const stopObsidian = async (userDataDir) => {
  const pattern = path.basename(userDataDir)
  for (const signal of ['TERM', 'KILL']) {
    await run('pkill', [`-${signal}`, '-f', '--', pattern])
    for (let attempt = 0; attempt < 25 && (await isRunning(pattern)); attempt += 1) {
      await delay(200)
    }
    if (!(await isRunning(pattern))) {
      return
    }
  }
}

// The process of the app in front, from LaunchServices, which needs no permission.
const getFrontPid = async () => {
  const app = (await run('lsappinfo', ['front'])).trim()
  const info = app === '' ? '' : await run('lsappinfo', ['info', '-only', 'pid', app])
  return Number(/pid = (\d+)/u.exec(info)?.[1] ?? 0)
}

const activate = (pid) =>
  run('osascript', [
    '-l',
    'JavaScript',
    '-e',
    `ObjC.import('AppKit'); $.NSRunningApplication.runningApplicationWithProcessIdentifier(${pid}).activateWithOptions(0)`,
  ])

// Electron brings Obsidian to the front each time it shows a window, and
// Obsidian's build allows no option against it. On macOS this guard gives the
// focus back to the app in use soon after the test Obsidian takes it.
const guardFocus = (userDataDir) => {
  if (process.platform !== 'darwin') {
    return () => undefined
  }
  const pattern = path.basename(userDataDir)
  let stopped = false
  let previousPid = 0
  void (async () => {
    while (!stopped) {
      const frontPid = await getFrontPid()
      if (frontPid !== 0) {
        const isTestObsidian = (await run('ps', ['-o', 'command=', '-p', String(frontPid)])).includes(pattern)
        if (!isTestObsidian) {
          previousPid = frontPid
        } else if (previousPid !== 0) {
          await activate(previousPid)
        }
      }
      await delay(200)
    }
  })()
  return () => {
    stopped = true
  }
}

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
const closeSettings = async (page) => {
  await page.evaluate(() => {
    window.app.setting.close()
    window.dispatchEvent(new FocusEvent('focus'))
  })
}

// Starts a separate Obsidian with its own profile, so the everyday Obsidian
// and its vaults stay untouched, opens `vaultPath` in it and installs the
// plugin's build. With `returnFocus`, the app in use keeps the focus.
export const launchObsidian = async ({
  vaultPath,
  port = 9300 + Math.floor(Math.random() * 500),
  returnFocus = true,
}) => {
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'tasks-table-obsidian-'))
  const stopGuard = returnFocus ? guardFocus(userDataDir) : () => undefined
  // Obsidian asks whether to trust a vault's plugins when it opens a vault that
  // has any, and trusting opens its settings in a window of its own. A vault
  // that already uses plugins gets the build now and goes through that prompt;
  // other vaults get it once Obsidian runs, so nothing is asked.
  const usesPlugins = existsSync(path.join(vaultPath, '.obsidian', 'community-plugins.json'))
  if (usesPlugins) {
    await installPlugin(vaultPath)
  }
  await writeFile(
    path.join(userDataDir, 'obsidian.json'),
    JSON.stringify({ vaults: { e2e: { path: vaultPath, ts: Date.now(), open: true } } }),
  )
  await copyAppUpdate(userDataDir)

  startObsidian([`--user-data-dir=${userDataDir}`, `--remote-debugging-port=${port}`, ...backgroundSwitches])
  const browser = await connect(port)
  const page = await findWorkspacePage(browser)
  // The page behaves as if its window had the focus, while the app in use keeps it.
  const session = await page.context().newCDPSession(page)
  await session.send('Emulation.setFocusEmulationEnabled', { enabled: true })
  // `app.workspace` exists from the start, but Obsidian reads the community
  // plugins later, before it loads the layout. A plugin copied in before that
  // read makes Obsidian ask whether to trust the vault.
  await page.waitForFunction(() => window.app.workspace.layoutReady, null, { timeout: 30000 })

  if (usesPlugins) {
    // Trusting loads the plugin; it is enabled by hand only when that did not
    // happen, because loading it twice registers its view twice.
    await page
      .getByRole('button', { name: 'Trust author and enable plugins' })
      .click({ timeout: 5000 })
      .catch(() => undefined)
    // Trusting also opens the community plugin settings, a moment later.
    await page.waitForFunction(() => window.app.setting.isOpen, null, { timeout: 5000 }).catch(() => undefined)
    await closeSettings(page)
  } else {
    await installPlugin(vaultPath)
  }
  await page
    .waitForFunction(() => Boolean(window.app.plugins.plugins['tasks-table']), null, { timeout: 2000 })
    .catch(async () => {
      await page.evaluate(async () => {
        await window.app.plugins.loadManifests()
        await window.app.plugins.setEnable(true)
        await window.app.plugins.enablePluginAndSave('tasks-table')
      })
    })

  return {
    page,
    port,
    userDataDir,
    // Also removes the profile: it holds a copy of the app update, about 40 MB.
    close: async () => {
      stopGuard()
      await browser.close().catch(() => undefined)
      await stopObsidian(userDataDir)
      await rm(userDataDir, { recursive: true, force: true, maxRetries: 3 })
    },
  }
}
