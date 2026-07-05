import { type ConditionValues, type SessionConditions } from '../types';

// Not-found semantics: reads return null; mutations THROW if the session id
// does not exist — a missing id in a mutation is a caller bug, not a normal
// state. (A conditions row always exists per session: docs/DATABASE.md §Regras 1.)
export interface ConditionsRepository {
  getBySessionId(sessionId: string): Promise<SessionConditions | null>;
  /**
   * Worker queue (docs/DATABASE.md §Regras 2): session ids WHERE fetch_status
   * IN ('pending','failed') AND retry_count < 5, LIMIT `limit`.
   *
   * Authorised evolution: may return FetchableSession (sessionId, lat, lon,
   * startedAtUtc) when the Fase 2 worker exists, to avoid 2 extra queries per
   * pending session.
   */
  listFetchable(limit: number): Promise<string[]>;
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
   * fetch_status='failed' either way (docs/OPEN_METEO.md §1, §6). See
   * saveSnapshot for the partial-result sequence (saveSnapshot then
   * markFailed(id, false)).
   */
  markFailed(sessionId: string, permanent: boolean): Promise<void>;
  /** Manual "tentar novamente": retry_count=0, fetch_status='pending' (docs/OPEN_METEO.md §6). */
  resetRetries(sessionId: string): Promise<void>;
}
