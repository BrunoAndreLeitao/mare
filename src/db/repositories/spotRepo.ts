import { type RepoDeps, type SqlDb, type SqlValue } from '../sqlDb';
import { type NewSpot, type Spot, type SpotChanges } from '../types';

// Not-found semantics: reads return null; mutations THROW if the id does not
// exist — a missing id in a mutation is a caller bug, not a normal state.
// Update semantics: undefined leaves a field untouched; explicit null clears
// a clearable field (notes) to SQL NULL — see SpotChanges in ../types.
export interface SpotRepository {
  create(input: NewSpot): Promise<Spot>;
  getById(id: string): Promise<Spot | null>;
  /** Spots with is_archived = 0. */
  listActive(): Promise<Spot[]>;
  update(id: string, changes: SpotChanges): Promise<Spot>;
  /** Soft delete (docs/DATABASE.md §Regras 4) — sessions keep referencing the spot. */
  archive(id: string): Promise<void>;
}

export interface SpotRow {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  notes: string | null;
  is_archived: number;
  created_at: number;
  updated_at: number;
}

// Exported for isolated testing and reuse by sessionRepo's JOINs (Fase 2).
export function rowToSpot(row: SpotRow): Spot {
  return {
    id: row.id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    notes: row.notes,
    isArchived: row.is_archived !== 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSpotRepo(db: SqlDb, deps: RepoDeps): SpotRepository {
  async function getById(id: string): Promise<Spot | null> {
    const row = await db.getFirstAsync<SpotRow>(
      'SELECT * FROM spots WHERE id = ?',
      [id],
    );
    return row === null ? null : rowToSpot(row);
  }

  return {
    async create(input: NewSpot): Promise<Spot> {
      const id = deps.uuid();
      const ts = deps.now();
      const notes = input.notes ?? null;
      await db.runAsync(
        `INSERT INTO spots (id, name, latitude, longitude, notes, is_archived, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
        [id, input.name, input.latitude, input.longitude, notes, ts, ts],
      );
      return {
        id,
        name: input.name,
        latitude: input.latitude,
        longitude: input.longitude,
        notes,
        isArchived: false,
        createdAt: ts,
        updatedAt: ts,
      };
    },

    getById,

    async listActive(): Promise<Spot[]> {
      const rows = await db.getAllAsync<SpotRow>(
        'SELECT * FROM spots WHERE is_archived = 0 ORDER BY name COLLATE NOCASE',
        [],
      );
      return rows.map(rowToSpot);
    },

    async update(id: string, changes: SpotChanges): Promise<Spot> {
      const sets: string[] = [];
      const params: SqlValue[] = [];
      if (changes.name !== undefined) {
        sets.push('name = ?');
        params.push(changes.name);
      }
      if (changes.latitude !== undefined) {
        sets.push('latitude = ?');
        params.push(changes.latitude);
      }
      if (changes.longitude !== undefined) {
        sets.push('longitude = ?');
        params.push(changes.longitude);
      }
      if (changes.notes !== undefined) {
        sets.push('notes = ?');
        params.push(changes.notes);
      }
      sets.push('updated_at = ?');
      params.push(deps.now());
      params.push(id);

      const result = await db.runAsync(
        `UPDATE spots SET ${sets.join(', ')} WHERE id = ?`,
        params,
      );
      if (result.changes === 0) {
        throw new Error(`Spot not found: ${id}`);
      }
      const spot = await getById(id);
      if (spot === null) {
        throw new Error(`Spot not found: ${id}`);
      }
      return spot;
    },

    async archive(id: string): Promise<void> {
      const result = await db.runAsync(
        'UPDATE spots SET is_archived = 1, updated_at = ? WHERE id = ?',
        [deps.now(), id],
      );
      if (result.changes === 0) {
        throw new Error(`Spot not found: ${id}`);
      }
    },
  };
}
