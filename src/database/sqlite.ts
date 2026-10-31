import type { BindParams, Database, SqlJsStatic, SqlValue } from 'sql.js'
import initSqlJs from 'sql.js/dist/sql-wasm-browser.js'
import wasmBinary from 'sql.js/dist/sql-wasm-browser.wasm'

export type { SqlValue }

let sqlJs: Promise<SqlJsStatic> | null = null

// The WebAssembly module ships inside main.js, so it works offline and on mobile.
export const loadSqlJs = (): Promise<SqlJsStatic> => {
  sqlJs ??= initSqlJs({ wasmBinary: wasmBinary.slice().buffer })
  return sqlJs
}

// A small synchronous wrapper over sql.js with the helpers the repositories use.
export class SqlDatabase {
  private transactionDepth = 0

  constructor(private readonly database: Database) {}

  exec(sql: string): void {
    this.database.exec(sql)
  }

  run(sql: string, params: BindParams = []): void {
    this.database.run(sql, params)
  }

  all<Row>(sql: string, params: BindParams = []): Row[] {
    const statement = this.database.prepare(sql)
    try {
      statement.bind(params)
      const rows: Row[] = []
      while (statement.step()) {
        rows.push(statement.getAsObject() as Row)
      }
      return rows
    } finally {
      statement.free()
    }
  }

  get<Row>(sql: string, params: BindParams = []): Row | undefined {
    return this.all<Row>(sql, params)[0]
  }

  transaction<Result>(callback: () => Result): Result {
    if (this.transactionDepth > 0) {
      return callback()
    }

    this.database.exec('begin immediate')
    this.transactionDepth += 1
    try {
      const result = callback()
      this.database.exec('commit')
      return result
    } catch (error) {
      this.database.exec('rollback')
      throw error
    } finally {
      this.transactionDepth -= 1
    }
  }

  export(): Uint8Array {
    return this.database.export()
  }

  close(): void {
    this.database.close()
  }
}

export const openSqlDatabase = async (bytes: Uint8Array | null): Promise<SqlDatabase> => {
  const SQL = await loadSqlJs()
  return new SqlDatabase(new SQL.Database(bytes ?? undefined))
}
