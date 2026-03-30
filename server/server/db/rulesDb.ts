import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { MockRule } from '../types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function getDbPath() {
  return path.join(__dirname, '..', 'db.sqlite')
}

export type RulesDb = ReturnType<typeof createRulesDb>

export function createRulesDb() {
  const db = new Database(getDbPath())

  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      method TEXT NOT NULL,
      urlPattern TEXT NOT NULL,
      status INTEGER NOT NULL,
      delayMs INTEGER NOT NULL,
      headersJson TEXT NOT NULL,
      body TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      lastHitAt TEXT
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  const getAllStmt = db.prepare(`
    SELECT id, name, enabled, method, urlPattern, status, delayMs, headersJson, body, createdAt, updatedAt, lastHitAt
    FROM rules
    ORDER BY updatedAt DESC
  `)

  const insertStmt = db.prepare(`
    INSERT INTO rules (id, name, enabled, method, urlPattern, status, delayMs, headersJson, body, createdAt, updatedAt, lastHitAt)
    VALUES (@id, @name, @enabled, @method, @urlPattern, @status, @delayMs, @headersJson, @body, @createdAt, @updatedAt, @lastHitAt)
  `)

  const updateStmt = db.prepare(`
    UPDATE rules
    SET name=@name,
        enabled=@enabled,
        method=@method,
        urlPattern=@urlPattern,
        status=@status,
        delayMs=@delayMs,
        headersJson=@headersJson,
        body=@body,
        updatedAt=@updatedAt,
        lastHitAt=@lastHitAt
    WHERE id=@id
  `)

  const deleteStmt = db.prepare(`DELETE FROM rules WHERE id=?`)
  const deleteAllStmt = db.prepare(`DELETE FROM rules`)

  const getConfigStmt = db.prepare(`SELECT value FROM config WHERE key=?`)
  const upsertConfigStmt = db.prepare(`
    INSERT INTO config (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
  `)

  function rowToRule(row: any): MockRule {
    return {
      id: row.id,
      name: row.name,
      enabled: Boolean(row.enabled),
      method: row.method,
      urlPattern: row.urlPattern,
      status: row.status,
      delayMs: row.delayMs,
      headers: JSON.parse(row.headersJson),
      body: row.body,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastHitAt: row.lastHitAt ?? undefined,
    }
  }

  return {
    getAllRules(): MockRule[] {
      return getAllStmt.all().map(rowToRule)
    },

    createRule(rule: MockRule): MockRule {
      insertStmt.run({
        ...rule,
        enabled: rule.enabled ? 1 : 0,
        headersJson: JSON.stringify(rule.headers ?? []),
        lastHitAt: rule.lastHitAt ?? null,
      })
      return rule
    },

    updateRule(rule: MockRule): MockRule | null {
      const res = updateStmt.run({
        ...rule,
        enabled: rule.enabled ? 1 : 0,
        headersJson: JSON.stringify(rule.headers ?? []),
        lastHitAt: rule.lastHitAt ?? null,
      })
      return res.changes > 0 ? rule : null
    },

    deleteRule(id: string): boolean {
      return deleteStmt.run(id).changes > 0
    },

    replaceAllRules(rules: MockRule[]) {
      const tx = db.transaction(() => {
        deleteAllStmt.run()
        for (const r of rules) {
          insertStmt.run({
            ...r,
            enabled: r.enabled ? 1 : 0,
            headersJson: JSON.stringify(r.headers ?? []),
            lastHitAt: r.lastHitAt ?? null,
          })
        }
      })
      tx()
    },

    getTargetBaseUrl(): string {
      const row = getConfigStmt.get('targetBaseUrl') as { value: string } | undefined
      return row?.value ?? ''
    },

    setTargetBaseUrl(url: string) {
      upsertConfigStmt.run('targetBaseUrl', url)
    },

    close() {
      db.close()
    },
  }
}

