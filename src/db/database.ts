import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { runMigrations } from './migrationRunner';
import { migrations } from './migrations';

let dbPromise: Promise<SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLiteDatabase> {
  if (dbPromise === null) {
    dbPromise = (async () => {
      const db = await openDatabaseAsync('mare.db');
      // Outside any transaction; foreign_keys is per-connection and must run
      // on every open.
      await db.execAsync('PRAGMA journal_mode = WAL');
      await db.execAsync('PRAGMA foreign_keys = ON');
      await runMigrations(db, migrations);
      return db;
    })().catch((error: unknown) => {
      dbPromise = null; // allow retry on next call instead of caching failure
      throw error;
    });
  }
  return dbPromise;
}
