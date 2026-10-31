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

// A small, tidy vault for the README screenshot, in the light theme.
export const createDemoVault = async (vaultPath) => {
  const config = path.join(vaultPath, '.obsidian')
  await mkdir(config, { recursive: true })
  await writeFile(path.join(config, 'appearance.json'), JSON.stringify({ theme: 'moonstone' }))
  // Sync is on by default and shows a red "disconnected" icon without an account.
  await writeFile(path.join(config, 'core-plugins.json'), JSON.stringify({ sync: false }))
  await writeFile(path.join(config, 'daily-notes.json'), JSON.stringify({ folder: 'Daily', format: 'YYYY-MM-DD' }))

  await write(vaultPath, 'Projects/Website relaunch.md', [
    '# Website relaunch',
    '',
    `- [/] Rewrite the pricing page copy ⏫ 📅 ${addDays(0)} #work/marketing`,
    `- [ ] Review homepage mockups with design 🔼 📅 ${addDays(1)} #work/design`,
    `- [ ] Ship the new navigation to beta users ⏫ 📅 ${addDays(6)} #work`,
    `\t- [ ] Write the beta announcement 📅 ${addDays(5)} #work/marketing`,
    `- [ ] Set up redirects for the old blog URLs 📅 ${addDays(4)} #work`,
    '- [ ] Fix contrast of the footer links 🔽 #work/design',
    `- [x] Choose a font pairing ✅ ${addDays(-2)} #work/design`,
    '',
  ].join('\n'))
  await write(vaultPath, 'Projects/Mobile app.md', [
    '# Mobile app',
    '',
    `- [/] Fix the crash on login with an expired token 🔺 📅 ${addDays(-1)} #work/bug`,
    `- [ ] Prepare App Store screenshots 🔼 📅 ${addDays(3)} #work/marketing`,
    `- [ ] Write release notes for 2.4 📅 ${addDays(5)} #work`,
    '- [ ] Test offline mode on Android 🔼 #work/qa',
    '',
  ].join('\n'))
  await write(vaultPath, 'Areas/Home.md', [
    '# Home',
    '',
    `- [ ] Renew the car insurance ⏫ 📅 ${addDays(2)} #finance`,
    '- [ ] Book a plumber for the kitchen sink 🔼 #home',
    `- [ ] Order a birthday gift for Mia 📅 ${addDays(8)} #people`,
    '- [ ] Donate old clothes 🔽 #home',
    '',
  ].join('\n'))
  await write(vaultPath, 'Areas/Health.md', [
    '# Health',
    '',
    `- [ ] Refill the prescription ⏫ 📅 ${addDays(-2)} #health`,
    `- [ ] Book a dentist appointment 🔼 📅 ${addDays(9)} #health`,
    '- [ ] Run 5 km three times this week #health/fitness',
    '',
  ].join('\n'))
  await write(vaultPath, `Daily/${addDays(-1)}.md`, [
    `# ${addDays(-1)}`,
    '',
    `- [ ] Send the invoice to Northwind ⏫ 📅 ${addDays(0)} #finance`,
    '- [ ] Reply to Anna about the offsite #people',
    `- [x] Gym ✅ ${addDays(-1)} #health/fitness`,
    '',
  ].join('\n'))
  await write(vaultPath, `Daily/${addDays(0)}.md`, [
    `# ${addDays(0)}`,
    '',
    '- [ ] Call the bank about the card limit 🔼 #finance',
    '- [ ] Read chapter 3 of Shape Up 🔽 #reading',
    '',
  ].join('\n'))
}

// Copies the freshly built plugin into the vault.
export const installPlugin = async (vaultPath) => {
  const pluginPath = path.join(vaultPath, '.obsidian', 'plugins', 'tasks-table')
  await mkdir(pluginPath, { recursive: true })
  for (const file of ['main.js', 'manifest.json', 'styles.css']) {
    await cp(path.join(root, file), path.join(pluginPath, file))
  }
}
