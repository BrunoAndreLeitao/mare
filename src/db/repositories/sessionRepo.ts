import { type NewSession, type Session, type SessionListItem } from '../types';

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
  /** History screen rows, aligned with the reference query in docs/DATABASE.md. */
  listWithDetails(limit: number, offset: number): Promise<SessionListItem[]>;
  /**
   * Changing startedAt or spotId invalidates conditions: fetch_status back to
   * 'pending', retry_count=0, values cleared — enforced here in the repo, not
   * trusted to the UI (docs/DATABASE.md §Regras 3).
   */
  update(id: string, changes: Partial<NewSession>): Promise<Session>;
  /** Hard delete — ON DELETE CASCADE clears the conditions row (docs/DATABASE.md §Regras 4). */
  delete(id: string): Promise<void>;
}
