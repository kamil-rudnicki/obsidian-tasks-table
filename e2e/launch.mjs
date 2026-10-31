// Opens a fixture vault in a separate Obsidian and keeps it running for manual
// or scripted checks: `node e2e/launch.mjs [vault path]`.
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createFixtureVault, installPlugin } from './fixtureVault.mjs'
import { launchObsidian } from './obsidian.mjs'

// A generated fixture vault is removed on exit; a vault passed in is kept.
const isFixtureVault = !process.argv[2]
const vaultPath = process.argv[2] ?? (await mkdtemp(path.join(tmpdir(), 'tasks-table-vault-')))
if (isFixtureVault) {
  await createFixtureVault(vaultPath)
}
await installPlugin(vaultPath)

const obsidian = await launchObsidian({ vaultPath, port: Number(process.env.PORT ?? 9333) })
console.log(JSON.stringify({ vaultPath, port: obsidian.port, userDataDir: obsidian.userDataDir }))

const stop = async () => {
  await obsidian.close()
  if (isFixtureVault) {
    await rm(vaultPath, { recursive: true, force: true })
  }
  process.exit(0)
}
process.on('SIGINT', () => void stop())
process.on('SIGTERM', () => void stop())
await new Promise(() => undefined)
