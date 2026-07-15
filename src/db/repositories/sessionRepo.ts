import { buildSetClause } from '../setClause';
import { type RepoDeps, type SqlDb } from '../sqlDb';
import {
  type Crowd,
  type FetchStatus,
  type NewSession,
  type Rating,
  type Session,
  type SessionChanges,
  type SessionListItem,
  type TidePhase,
} from '../types';

// Field → column for the sessions table (drives buildSetClause). updated_at is
// NOT here — it is metadata the repo bumps, not a caller-provided field.
const SESSION_COLUMN_MAP: Record<keyof SessionChanges, string> = {
  spotId: 'spot_id',
  boardId: 'board_id',
  startedAt: 'started_at',
  durationMin: 'duration_min',
  rating: 'rating',
  crowd: 'crowd',
  notes: 'notes',
};

// Not-found semantics: reads return null; mutations THROW if the id does not
// exist — a missing id in a mutation is a caller bug, not a normal state.
export interface SessionRepository {
  /**
   * Single transaction inserting `sessions` AND `session_conditions` with
   * fetch_status='pending' and all values NULL (docs/DATABASE.md §Regras 1).
   * Never blocks on network — conditions arrive later via the fetch worker.
   */
  create(input: NewSession): Promise<Session>;
  getById(id: string): Promise<Session | null>;
  /** Spot da sessão registada mais recentemente (pré-seleção no ecrã Nova sessão); null sem sessões. */
  getLastUsedSpotId(): Promise<string | null>;
  /** History screen rows — the reference query in docs/DATABASE.md (JOIN spots,
   * LEFT JOIN boards, LEFT JOIN conditions), ordered by started_at DESC. */
  listWithDetails(limit: number, offset: number): Promise<SessionListItem[]>;
  /**
   * Changing startedAt or spotId invalidates conditions: fetch_status back to
   * 'pending', retry_count=0, values cleared — enforced here in the repo, not
   * trusted to the UI (docs/DATABASE.md §Regras 3).
   */
  update(id: string, changes: SessionChanges): Promise<Session>;
  /** Hard delete — ON DELETE CASCADE clears the conditions row (docs/DATABASE.md §Regras 4). */
  delete(id: string): Promise<void>;
}

export interface SessionRow {
  id: string;
  spot_id: string;
  board_id: string | null;
  started_at: number;
  duration_min: number | null;
  rating: number;
  crowd: number | null;
  notes: string | null;
  created_at: number;
  updated_at: number;
}

// Exported for isolated testing. NOT reused by the history screen — that row
// joins 3 tables into SessionListItem and gets its own mapper in Tarefa 7.
export function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    spotId: row.spot_id,
    boardId: row.board_id,
    startedAt: row.started_at,
    durationMin: row.duration_min,
    rating: row.rating as Rating,
    crowd: row.crowd as Crowd | null,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Row of the 3-way history JOIN (docs/DATABASE.md reference query). Own shape,
// own mapper — NOT rowToSession: this row carries aliased columns of 3 tables.
export interface SessionListRow extends SessionRow {
  spot_name: string;
  board_name: string | null;
  swell_height_m: number | null;
  swell_period_s: number | null;
  wind_speed_kmh: number | null;
  wind_direction_deg: number | null;
  tide_phase: string | null;
  fetch_status: string;
}

// Exported for isolated testing (vinculativo da Tarefa 7).
export function rowToSessionListItem(row: SessionListRow): SessionListItem {
  return {
    id: row.id,
    spotId: row.spot_id,
    boardId: row.board_id,
    startedAt: row.started_at,
    durationMin: row.duration_min,
    rating: row.rating as Rating,
    crowd: row.crowd as Crowd | null,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    spotName: row.spot_name,
    boardName: row.board_name,
    swellHeightM: row.swell_height_m,
    swellPeriodS: row.swell_period_s,
    windSpeedKmh: row.wind_speed_kmh,
    windDirectionDeg: row.wind_direction_deg,
    tidePhase: row.tide_phase as TidePhase | null,
    fetchStatus: row.fetch_status as FetchStatus,
  };
}

// Resets every measured column to NULL and the fetch metadata to a fresh
// pending state, so the worker refetches (docs/DATABASE.md §Regras 3). source
// stays; raw_json is cleared because the old slice no longer matches.
const INVALIDATE_CONDITIONS_SQL = `UPDATE session_conditions SET
  wave_height_m = NULL, wave_direction_deg = NULL, wave_period_s = NULL,
  swell_height_m = NULL, swell_direction_deg = NULL, swell_period_s = NULL,
  swell_peak_period_s = NULL, wind_wave_height_m = NULL, sea_level_msl_m = NULL,
  tide_phase = NULL, water_temp_c = NULL, wind_speed_kmh = NULL,
  wind_gusts_kmh = NULL, wind_direction_deg = NULL, wind_relation = NULL,
  raw_json = NULL, fetch_status = 'pending', retry_count = 0, fetched_at = NULL
  WHERE session_id = ?`;

export function createSessionRepo(db: SqlDb, deps: RepoDeps): SessionRepository {
  async function getById(id: string): Promise<Session | null> {
    const row = await db.getFirstAsync<SessionRow>(
      'SELECT * FROM sessions WHERE id = ?',
      [id],
    );
    return row === null ? null : rowToSession(row);
  }

  return {
    async create(input: NewSession): Promise<Session> {
      const id = deps.uuid();
      const ts = deps.now(); // registo: created_at/updated_at. NUNCA started_at.
      const boardId = input.boardId ?? null;
      const durationMin = input.durationMin ?? null;
      const crowd = input.crowd ?? null;
      const notes = input.notes ?? null;

      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `INSERT INTO sessions
             (id, spot_id, board_id, started_at, duration_min, rating, crowd, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          // started_at é SEMPRE input.startedAt (hora em que surfou), não ts.
          [id, input.spotId, boardId, input.startedAt, durationMin, input.rating, crowd, notes, ts, ts],
        );
        // Column defaults materialise fetch_status='pending', retry_count=0,
        // source='open-meteo'; every measured value stays NULL.
        await db.runAsync('INSERT INTO session_conditions (session_id) VALUES (?)', [id]);
      });

      return {
        id,
        spotId: input.spotId,
        boardId,
        startedAt: input.startedAt,
        durationMin,
        rating: input.rating,
        crowd,
        notes,
        createdAt: ts,
        updatedAt: ts,
      };
    },

    getById,

    async listWithDetails(limit: number, offset: number): Promise<SessionListItem[]> {
      // JOIN spots SEM filtro de is_archived: um spot arquivado continua no
      // histórico — é a razão de ser do soft delete (docs/DATABASE.md §Regras 4).
      const rows = await db.getAllAsync<SessionListRow>(
        `SELECT s.*, sp.name AS spot_name, b.name AS board_name,
                c.swell_height_m, c.swell_period_s, c.wind_speed_kmh,
                c.wind_direction_deg, c.tide_phase, c.fetch_status
         FROM sessions s
         JOIN spots sp ON sp.id = s.spot_id
         LEFT JOIN boards b ON b.id = s.board_id
         LEFT JOIN session_conditions c ON c.session_id = s.id
         ORDER BY s.started_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset],
      );
      return rows.map(rowToSessionListItem);
    },

    async getLastUsedSpotId(): Promise<string | null> {
      // rowid como desempate: created_at tem resolução de segundos e dois
      // registos seguidos podem colidir; rowid preserva a ordem de inserção.
      const row = await db.getFirstAsync<{ spot_id: string }>(
        'SELECT spot_id FROM sessions ORDER BY created_at DESC, rowid DESC LIMIT 1',
        [],
      );
      return row === null ? null : row.spot_id;
    },

    async update(id: string, changes: SessionChanges): Promise<Session> {
      const current = await getById(id);
      if (current === null) {
        throw new Error(`Session not found: ${id}`);
      }
      const invalidate =
        (changes.startedAt !== undefined && changes.startedAt !== current.startedAt) ||
        (changes.spotId !== undefined && changes.spotId !== current.spotId);

      const { clause, params } = buildSetClause(changes, SESSION_COLUMN_MAP);
      // updated_at is the repo's bump, appended after the caller's fields.
      const setClause = clause === '' ? 'updated_at = ?' : `${clause}, updated_at = ?`;

      await db.withTransactionAsync(async () => {
        const result = await db.runAsync(
          `UPDATE sessions SET ${setClause} WHERE id = ?`,
          [...params, deps.now(), id],
        );
        if (result.changes === 0) {
          throw new Error(`Session not found: ${id}`);
        }
        if (invalidate) {
          await db.runAsync(INVALIDATE_CONDITIONS_SQL, [id]);
        }
      });

      const updated = await getById(id);
      if (updated === null) {
        throw new Error(`Session not found: ${id}`);
      }
      return updated;
    },

    async delete(id: string): Promise<void> {
      const result = await db.runAsync('DELETE FROM sessions WHERE id = ?', [id]);
      if (result.changes === 0) {
        throw new Error(`Session not found: ${id}`);
      }
    },
  };
}
