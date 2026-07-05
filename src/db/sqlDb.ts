// Minimal parameterized-SQL surface the repositories need. expo-sqlite's
// SQLiteDatabase satisfies it structurally (the composition point in index.ts
// is where tsc proves it); tests back it with a better-sqlite3 adapter.
export type SqlValue = string | number | null;

export interface SqlDb {
  // { changes } instead of void: mutations detect a missing id in a single
  // round-trip (changes === 0 -> throw). SQLiteRunResult satisfies it.
  runAsync(source: string, params: SqlValue[]): Promise<{ changes: number }>;
  getFirstAsync<T>(source: string, params: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]>;
}

// Injected by the composition point (expo-crypto / Date.now) so repositories
// have zero expo imports and tests stay deterministic.
export interface RepoDeps {
  uuid(): string;
  /** Epoch seconds UTC, as stored in the DB. */
  now(): number;
}
