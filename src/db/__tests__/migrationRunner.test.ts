import Database from 'better-sqlite3';

import { type Migration, type MigrationDb, runMigrations } from '../migrationRunner';
import { migrations } from '../migrations';

// Real SQLite in memory; no expo-sqlite mocks. better-sqlite3 is synchronous,
// so the adapter just wraps calls in resolved promises.
class BetterSqliteMigrationDb implements MigrationDb {
  constructor(private readonly db: Database.Database) {}

  async execAsync(source: string): Promise<void> {
    this.db.exec(source);
  }

  async getFirstAsync<T>(source: string): Promise<T | null> {
    return (this.db.prepare(source).get() as T | undefined) ?? null;
  }
}

function schemaVersion(raw: Database.Database): number {
  const row = raw.prepare('SELECT version FROM schema_version').get() as {
    version: number;
  };
  return row.version;
}

function tableExists(raw: Database.Database, name: string): boolean {
  const row = raw
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name);
  return row !== undefined;
}

// CREATE TABLE deliberately without IF NOT EXISTS: re-applying any of these
// fixtures throws, so idempotence failures cannot pass silently.
const v1: Migration = {
  version: 1,
  statements: ['CREATE TABLE fixture_a (id TEXT PRIMARY KEY)'],
};
const v2: Migration = {
  version: 2,
  statements: ['CREATE TABLE fixture_b (id TEXT PRIMARY KEY)'],
};

describe('runMigrations', () => {
  let raw: Database.Database;
  let db: MigrationDb;

  beforeEach(() => {
    raw = new Database(':memory:');
    db = new BetterSqliteMigrationDb(raw);
  });

  afterEach(() => {
    raw.close();
  });

  test('(a) empty DB migrates from 0 to the highest version', async () => {
    await runMigrations(db, [v1, v2]);

    expect(schemaVersion(raw)).toBe(2);
    expect(tableExists(raw, 'fixture_a')).toBe(true);
    expect(tableExists(raw, 'fixture_b')).toBe(true);
  });

  test('(b) running twice is idempotent and keeps the version', async () => {
    await runMigrations(db, [v1, v2]);
    await expect(runMigrations(db, [v1, v2])).resolves.toBeUndefined();

    expect(schemaVersion(raw)).toBe(2);
  });

  test('(c) invalid SQL rolls back the whole migration and the version does not advance', async () => {
    const v2Broken: Migration = {
      version: 2,
      statements: [
        'CREATE TABLE fixture_b (id TEXT PRIMARY KEY)', // valid, must be rolled back
        'THIS IS NOT SQL',
      ],
    };

    await expect(runMigrations(db, [v1, v2Broken])).rejects.toThrow();

    expect(schemaVersion(raw)).toBe(1);
    expect(tableExists(raw, 'fixture_a')).toBe(true);
    // Proves rollback, not just the version staying put.
    expect(tableExists(raw, 'fixture_b')).toBe(false);
  });

  test('(d) migrations apply in version order even when declared out of order', async () => {
    const v2Insert: Migration = {
      version: 2,
      statements: ["INSERT INTO fixture_a (id) VALUES ('from-v2')"], // needs v1 first
    };

    await runMigrations(db, [v2Insert, v1]);

    expect(schemaVersion(raw)).toBe(2);
    const row = raw.prepare('SELECT id FROM fixture_a').get() as { id: string };
    expect(row.id).toBe('from-v2');
  });

  test('(e) 001_initial: empty DB migrates 0 -> v1 with the real schema', async () => {
    await runMigrations(db, migrations);

    expect(schemaVersion(raw)).toBe(1);

    for (const table of [
      'schema_version',
      'spots',
      'boards',
      'sessions',
      'session_conditions',
    ]) {
      expect(tableExists(raw, table)).toBe(true);
    }

    const indexes = raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'")
      .all()
      .map((r) => (r as { name: string }).name)
      .sort();
    expect(indexes).toEqual([
      'idx_conditions_status',
      'idx_sessions_spot_started',
      'idx_sessions_started',
    ]);
  });
});
