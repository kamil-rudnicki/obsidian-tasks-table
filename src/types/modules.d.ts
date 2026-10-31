declare module 'sql.js/dist/sql-wasm-browser.js' {
  import initSqlJs from 'sql.js'
  export default initSqlJs
}

// esbuild's binary loader and the test setup both import WebAssembly as bytes.
declare module '*.wasm' {
  const bytes: Uint8Array
  export default bytes
}
