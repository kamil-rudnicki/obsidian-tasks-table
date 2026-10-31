import { cp, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')

const pad = (value) => String(value).padStart(2, '0')
const isoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const addDays = (days) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return isoDate(date)
}

const write = async (vaultPath, notePath, content) => {
  const filePath = path.join(vaultPath, notePath)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, content)
}

// Notes with tasks in both formats the plugin reads, plus a bulk folder for
// scrolling and indexing speed.
export const createFixtureVault = async (vaultPath, { bulkTasks = 2000 } = {}) => {
  const config = path.join(vaultPath, '.obsidian')
  await mkdir(path.join(config, 'plugins', 'obsidian-tasks-plugin'), { recursive: true })
  await writeFile(
    path.join(config, 'daily-notes.json'),
    JSON.stringify({ folder: 'Daily', format: 'YYYY-MM-DD', template: 'Templates/Daily' }),
  )
  await write(vaultPath, 'Templates/Daily.md', '# {{title}}\n\n')
  await writeFile(
    path.join(config, 'plugins', 'obsidian-tasks-plugin', 'data.json'),
    JSON.stringify({ taskFormat: 'dataview', setCreatedDate: true }),
  )

  await write(vaultPath, 'Projects/Website.md', [
    '# Website',
    '',
    `- [ ] Write landing page copy ⏫ 📅 ${addDays(-2)} #work/marketing`,
    `- [/] Review pricing page [priority:: high] [due:: ${addDays(0)}] #work`,
    `- [ ] Ship beta to 100% of users 🔼 📅 ${addDays(3)} 🛫 ${addDays(1)} #work`,
    `- [x] Set up analytics ✅ ${addDays(-1)}`,
    '- [-] Old redesign idea [cancelled:: 2026-01-10]',
    '- [ ] Plan v2 🔽 [[Roadmap]]',
    '- [ ] Prepare offsite agenda #work',
    '\t- [ ] Book venue',
    '',
  ].join('\n'))
  await write(vaultPath, 'Personal/Home.md', [
    '# Home',
    '',
    `- [ ] Pay rent ⏫ 📅 ${addDays(1)} #home`,
    '- [ ] Ford polisa ⏫ 🛫  [priority:: high]  [start:: 2025-10-10]',
    `- [ ] Book dentist [due:: ${addDays(10)}] #health`,
    '- [x] Żółw feeding #home',
    '',
  ].join('\n'))
  await write(vaultPath, `Daily/${addDays(-1)}.md`, `# Yesterday\n\n- [ ] Call Ann #people\n- [x] Gym ✅ ${addDays(-1)}\n`)
  await write(vaultPath, 'Notes/No tasks.md', '# Just text\n\nNothing to do here.\n')
  await write(vaultPath, 'Projects/Fields.md', [
    '- [ ] Draft budget [type:: work] [estimate:: 3]',
    '- [ ] Fix bike [type:: home] [estimate:: 1] [person:: [[People/Ann Smith|Ann]]]',
    '',
  ].join('\n'))

  const perNote = 50
  for (let note = 0; note < Math.ceil(bulkTasks / perNote); note += 1) {
    const lines = []
    for (let task = 0; task < perNote; task += 1) {
      const number = note * perNote + task
      const status = number % 7 === 0 ? 'x' : number % 11 === 0 ? '/' : ' '
      const due = number % 3 === 0 ? ` 📅 ${addDays((number % 40) - 20)}` : ''
      const priority = ['', ' ⏫', ' 🔼', ' 🔽', ''][number % 5]
      lines.push(`- [${status}] Bulk task ${number}${priority}${due} #bulk/${number % 4}`)
    }
    await write(vaultPath, `Archive/Bulk ${pad(note)}.md`, `${lines.join('\n')}\n`)
  }
}

// Copies the freshly built plugin into the vault.
export const installPlugin = async (vaultPath) => {
  const pluginPath = path.join(vaultPath, '.obsidian', 'plugins', 'tasks-table')
  await mkdir(pluginPath, { recursive: true })
  for (const file of ['main.js', 'manifest.json', 'styles.css']) {
    await cp(path.join(root, file), path.join(pluginPath, file))
  }
}
