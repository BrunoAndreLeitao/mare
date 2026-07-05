import { type NewSpot, type Spot } from '../types';

// Not-found semantics: reads return null; mutations THROW if the id does not
// exist — a missing id in a mutation is a caller bug, not a normal state.
export interface SpotRepository {
  create(input: NewSpot): Promise<Spot>;
  getById(id: string): Promise<Spot | null>;
  /** Spots with is_archived = 0. */
  listActive(): Promise<Spot[]>;
  update(id: string, changes: Partial<NewSpot>): Promise<Spot>;
  /** Soft delete (docs/DATABASE.md §Regras 4) — sessions keep referencing the spot. */
  archive(id: string): Promise<void>;
}
