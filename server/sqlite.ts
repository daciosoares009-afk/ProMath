import { DatabaseSync } from 'node:sqlite'
import type { Store, Transaction } from './store.ts'

export function sqliteStore(path: string): Store & { close: () => void } {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS documents (collection TEXT, id TEXT, value TEXT NOT NULL, PRIMARY KEY (collection, id))')
  const get = db.prepare('SELECT value FROM documents WHERE collection = ? AND id = ?')
  const list = db.prepare('SELECT value FROM documents WHERE collection = ?')
  const set = db.prepare('INSERT INTO documents VALUES (?, ?, ?) ON CONFLICT(collection, id) DO UPDATE SET value = excluded.value')
  const transaction: Transaction = {
    async get(collection, id) {
      const row = get.get(collection, id)
      return row ? JSON.parse(String(row.value)) : undefined
    },
    async list(collection, { sort = [], limit } = {}) {
      const rows = list.all(collection).map(row => JSON.parse(String(row.value)))
      rows.sort((a, b) => {
        for (const [field, order] of sort) {
          if (a[field] !== b[field]) return (a[field] < b[field] ? -1 : 1) * (order === 'asc' ? 1 : -1)
        }
        return 0
      })
      return rows.slice(0, limit)
    },
    set(collection, id, value) { set.run(collection, id, JSON.stringify(value)) },
  }
  let pending = Promise.resolve()
  return {
    close() { db.close() },
    run(work) {
      const result = pending.then(async () => {
        db.exec('BEGIN IMMEDIATE')
        try {
          const value = await work(transaction)
          db.exec('COMMIT')
          return value
        } catch (error) {
          db.exec('ROLLBACK')
          throw error
        }
      })
      pending = result.then(() => {}, () => {})
      return result
    },
  }
}
