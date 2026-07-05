import Database from 'better-sqlite3';

import { type MigrationDb } from '../../migrationRunner';
import { type RepoDeps, type SqlDb, type SqlValue } from '../../sqlDb';

// Real SQLite in memory with the real schema; no mocks. Shared by every
// repository test suite.
export class BetterSqliteDb implements SqlDb, MigrationDb {
  constructor(private readonly db: Database.Database) {}

  async execAsync(source: string): Promise<void> {
    this.db.exec(source);
  }

  async runAsync(source: string, params: SqlValue[]): Promise<{ changes: number }> {
    const result = this.db.prepare(source).run(...params);
    return { changes: result.changes };
  }

  async getFirstAsync<T>(source: string, params: SqlValue[] = []): Promise<T | null> {
    return (this.db.prepare(source).get(...params) as T | undefined) ?? null;
  }

  async getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]> {
    return this.db.prepare(source).all(...params) as T[];
  }
}

// Deterministic deps: sequential uuids, controllable clock.
export function makeDeps(): RepoDeps & { clock: { value: number } } {
  let counter = 0;
  const clock = { value: 1_000 };
  return {
    uuid: () => `uuid-${++counter}`,
    now: () => clock.value,
    clock,
  };
}
