import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(import.meta.dirname, 'src/shared'),
      '@': path.resolve(import.meta.dirname, 'src/ui'),
      // esbuild embeds the WebAssembly as bytes; tests read the file instead.
      'sql.js/dist/sql-wasm-browser.wasm': path.resolve(import.meta.dirname, 'testing/sqlWasmBytes.ts'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    environment: 'node',
    setupFiles: ['testing/setup.ts'],
  },
})
