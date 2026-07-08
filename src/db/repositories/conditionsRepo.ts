import { buildSetClause } from '../setClause';
import { type RepoDeps, type SqlDb } from '../sqlDb';
import {
  type ConditionValues,
  type FetchableSession,
  type FetchStatus,
  type SessionConditions,
  type TidePhase,
  type WindRelation,
} from '../types';

// Not-found semantics: reads return null; mutations THROW if the session id
// does not exist — a missing id in a mutation is a caller bug, not a normal
// state. (A conditions row always exists per session: docs/DATABASE.md §Regras 1.)
export interface ConditionsRepository {
  getBySessionId(sessionId: string): Promise<SessionConditions | null>;
  /**
   * Worker queue (docs/DATABASE.md §Regras 2): sessions WHERE fetch_status
   * IN ('pending','failed') AND retry_count < 5, LIMIT `limit`. Returns
   * FetchableSession (JOIN sessions + spots) so the worker gets lat/lon and the
   * raw epoch startedAt without running its own SQL — all SQL stays in the repo.
   */
  listFetchable(limit: number): Promise<FetchableSession[]>;
  /**
   * Writes values, sets fetch_status='ok' and fetchedAt — for COMPLETE
   * snapshots. On a partial result (marine XOR forecast failed), the worker
   * calls saveSnapshot(partial values) followed by markFailed(id, false) —
   * in that order — so the values stay written but the status ends 'failed'
   * and the session remains fetchable for retry. Writes are idempotent per
   * column (docs/OPEN_METEO.md §2), so the retry completes the missing half.
   */
  saveSnapshot(sessionId: string, values: ConditionValues): Promise<void>;
  /**
   * permanent=true (e.g. HTTP 400, malformed request): retry_count jumps to 5
   * so the worker skips it; otherwise increments retry_count. Sets
   * fetch_status='failed' either way (docs/OPEN_METEO.md §1, §6).
   */
  markFailed(sessionId: string, permanent: boolean): Promise<void>;
  /** Manual "tentar novamente": retry_count=0, fetch_status='pending' (docs/OPEN_METEO.md §6). */
  resetRetries(sessionId: string): Promise<void>;
}

// ConditionValues field → column (drives buildSetClause in saveSnapshot).
// fetch_status/fetched_at are metadata the repo sets, not caller values.
const CONDITIONS_COLUMN_MAP: Record<keyof ConditionValues, string> = {
  waveHeightM: 'wave_height_m',
  waveDirectionDeg: 'wave_direction_deg',
  wavePeriodS: 'wave_period_s',
  swellHeightM: 'swell_height_m',
  swellDirectionDeg: 'swell_direction_deg',
  swellPeriodS: 'swell_period_s',
  swellPeakPeriodS: 'swell_peak_period_s',
  windWaveHeightM: 'wind_wave_height_m',
  seaLevelMslM: 'sea_level_msl_m',
  tidePhase: 'tide_phase',
  waterTempC: 'water_temp_c',
  windSpeedKmh: 'wind_speed_kmh',
  windGustsKmh: 'wind_gusts_kmh',
  windDirectionDeg: 'wind_direction_deg',
  windRelation: 'wind_relation',
  rawJson: 'raw_json',
};

export interface ConditionsRow {
  session_id: string;
  wave_height_m: number | null;
  wave_direction_deg: number | null;
  wave_period_s: number | null;
  swell_height_m: number | null;
  swell_direction_deg: number | null;
  swell_period_s: number | null;
  swell_peak_period_s: number | null;
  wind_wave_height_m: number | null;
  sea_level_msl_m: number | null;
  tide_phase: string | null;
  water_temp_c: number | null;
  wind_speed_kmh: number | null;
  wind_gusts_kmh: number | null;
  wind_direction_deg: number | null;
  wind_relation: string | null;
  fetch_status: string;
  retry_count: number;
  fetched_at: number | null;
  source: string;
  raw_json: string | null;
}

export function rowToSessionConditions(row: ConditionsRow): SessionConditions {
  return {
    sessionId: row.session_id,
    waveHeightM: row.wave_height_m,
    waveDirectionDeg: row.wave_direction_deg,
    wavePeriodS: row.wave_period_s,
    swellHeightM: row.swell_height_m,
    swellDirectionDeg: row.swell_direction_deg,
    swellPeriodS: row.swell_period_s,
    swellPeakPeriodS: row.swell_peak_period_s,
    windWaveHeightM: row.wind_wave_height_m,
    seaLevelMslM: row.sea_level_msl_m,
    tidePhase: row.tide_phase as TidePhase | null,
    waterTempC: row.water_temp_c,
    windSpeedKmh: row.wind_speed_kmh,
    windGustsKmh: row.wind_gusts_kmh,
    windDirectionDeg: row.wind_direction_deg,
    windRelation: row.wind_relation as WindRelation | null,
    fetchStatus: row.fetch_status as FetchStatus,
    retryCount: row.retry_count,
    fetchedAt: row.fetched_at,
    source: row.source,
    rawJson: row.raw_json,
  };
}

interface FetchableRow {
  session_id: string;
  latitude: number;
  longitude: number;
  started_at: number;
}

export function createConditionsRepo(db: SqlDb, deps: RepoDeps): ConditionsRepository {
  return {
    async getBySessionId(sessionId: string): Promise<SessionConditions | null> {
      const row = await db.getFirstAsync<ConditionsRow>(
        'SELECT * FROM session_conditions WHERE session_id = ?',
        [sessionId],
      );
      return row === null ? null : rowToSessionConditions(row);
    },

    async listFetchable(limit: number): Promise<FetchableSession[]> {
      const rows = await db.getAllAsync<FetchableRow>(
        `SELECT c.session_id, sp.latitude, sp.longitude, s.started_at
         FROM session_conditions c
         JOIN sessions s ON s.id = c.session_id
         JOIN spots sp ON sp.id = s.spot_id
         WHERE c.fetch_status IN ('pending', 'failed') AND c.retry_count < 5
         ORDER BY s.started_at DESC
         LIMIT ?`,
        [limit],
      );
      return rows.map((row) => ({
        sessionId: row.session_id,
        latitude: row.latitude,
        longitude: row.longitude,
        startedAtUtc: row.started_at, // epoch UTC cru — sem conversão de fuso.
      }));
    },

    async saveSnapshot(sessionId: string, values: ConditionValues): Promise<void> {
      const { clause, params } = buildSetClause(values, CONDITIONS_COLUMN_MAP);
      // ok + fetched_at are the repo's metadata, appended after the values.
      const setClause =
        clause === ''
          ? "fetch_status = 'ok', fetched_at = ?"
          : `${clause}, fetch_status = 'ok', fetched_at = ?`;
      const result = await db.runAsync(
        `UPDATE session_conditions SET ${setClause} WHERE session_id = ?`,
        [...params, deps.now(), sessionId],
      );
      if (result.changes === 0) {
        throw new Error(`Conditions not found: ${sessionId}`);
      }
    },

    async markFailed(sessionId: string, permanent: boolean): Promise<void> {
      // permanent jumps to the retry ceiling so the worker skips it; otherwise
      // increment in SQL (no read needed).
      const sql = permanent
        ? "UPDATE session_conditions SET fetch_status = 'failed', retry_count = 5 WHERE session_id = ?"
        : "UPDATE session_conditions SET fetch_status = 'failed', retry_count = retry_count + 1 WHERE session_id = ?";
      const result = await db.runAsync(sql, [sessionId]);
      if (result.changes === 0) {
        throw new Error(`Conditions not found: ${sessionId}`);
      }
    },

    async resetRetries(sessionId: string): Promise<void> {
      const result = await db.runAsync(
        "UPDATE session_conditions SET retry_count = 0, fetch_status = 'pending' WHERE session_id = ?",
        [sessionId],
      );
      if (result.changes === 0) {
        throw new Error(`Conditions not found: ${sessionId}`);
      }
    },
  };
}
