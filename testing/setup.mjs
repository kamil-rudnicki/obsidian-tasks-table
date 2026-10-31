// Plugin code uses `window` timers, as Obsidian asks for pop-out window support.
// Tests run in Node, where the global object plays that role.
Object.assign(globalThis, { window: globalThis })
