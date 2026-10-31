import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/native/d1', () => ({ batchD1: vi.fn() }))

const { schemaStatements } = await import('./spaktok-schema')

const normalize = (sql: string) =>
  sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ').replace(/\s*([(),])\s*/g, '$1').trim()

function migrationStatements(file: string): string[] {
  return readFileSync(`cloudflare/migrations/${file}`, 'utf8')
    .replace(/--.*$/gm, '').split(';').map(normalize).filter(Boolean)
}

describe('runtime schema bootstrap', () => {
  it.each([
    ['pk', '20261031_live_pk_battles.sql'],
    ['reports', '20261031_content_reports.sql'],
  ] as const)('%s matches its migration file', (name, file) => {
    expect(schemaStatements(name).map(normalize)).toEqual(migrationStatements(file))
  })

  it('only contains idempotent statements', () => {
    for (const sql of [...schemaStatements('pk'), ...schemaStatements('reports')]) {
      expect(sql).toMatch(/^CREATE (TABLE|INDEX) IF NOT EXISTS /)
    }
  })
})
