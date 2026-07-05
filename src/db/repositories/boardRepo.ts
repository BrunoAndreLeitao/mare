import { type Board, type NewBoard } from '../types';

// Not-found semantics: reads return null; mutations THROW if the id does not
// exist — a missing id in a mutation is a caller bug, not a normal state.
export interface BoardRepository {
  create(input: NewBoard): Promise<Board>;
  getById(id: string): Promise<Board | null>;
  /** Boards with is_archived = 0. */
  listActive(): Promise<Board[]>;
  update(id: string, changes: Partial<NewBoard>): Promise<Board>;
  /** Soft delete (docs/DATABASE.md §Regras 4) — sessions keep referencing the board. */
  archive(id: string): Promise<void>;
}
