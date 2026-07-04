import { type Migration } from './migrations';

// Minimal surface the migration runner needs. expo-sqlite's SQLiteDatabase
// satisfies it structurally; tests back it with a better-sqlite3 adapter.
export interface MigrationDb {
  execAsync(source: string): Promise<void>;
  getFirstAsync<T>(source: string): Promise<T | null>;
}

// The runner owns schema_version: migrations never create or update it.
export async function runMigrations(
  db: MigrationDb,
  all: Migration[],
): Promise<void> {
  await db.execAsync(
    'CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)',
  );
  const row = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_version',
  );
  if (row === null) {
    await db.execAsync('INSERT INTO schema_version (version) VALUES (0)');
  }
  const current = row?.version ?? 0;

  const pending = [...all]
    .sort((a, b) => a.version - b.version)
    .filter((m) => m.version > current);

  for (const migration of pending) {
    // BEGIN/COMMIT via execAsync keeps MigrationDb adapter-friendly
    // (no expo-only transaction API); migrations run one at a time at startup.
    await db.execAsync('BEGIN');
    try {
      for (const statement of migration.statements) {
        await db.execAsync(statement);
      }
      await db.execAsync(`UPDATE schema_version SET version = ${migration.version}`);
      await db.execAsync('COMMIT');
    } catch (error) {
      await db.execAsync('ROLLBACK');
      throw error;
    }
  }
}
