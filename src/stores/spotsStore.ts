import { create } from 'zustand';

import { getSpotRepo } from '../db';
import { type NewSpot, type Spot, type SpotChanges } from '../db/types';
import { t } from '../i18n';

// Mutations reload listActive instead of patching the array locally: keeps the
// NOCASE name ordering correct after renames for the price of one local query.
// The repo is fetched per action — getDatabase() caches, so this costs a
// resolved await and spares the store any init/lifecycle state.
// Repo throws never escape to an onPress: every action catches and writes error.
interface SpotsState {
  spots: Spot[];
  loading: boolean;
  error: string | null;
  load(): Promise<void>;
  /** Returns the created spot, or null on failure (error is set). */
  create(input: NewSpot): Promise<Spot | null>;
  /** Returns the updated spot, or null on failure (error is set). */
  update(id: string, changes: SpotChanges): Promise<Spot | null>;
  /** Returns false on failure (error is set). */
  archive(id: string): Promise<boolean>;
}

export const useSpotsStore = create<SpotsState>()((set, get) => ({
  spots: [],
  loading: false,
  error: null,

  async load() {
    set({ loading: true, error: null });
    try {
      const repo = await getSpotRepo();
      set({ spots: await repo.listActive(), loading: false });
    } catch {
      set({ loading: false, error: t.common.genericError });
    }
  },

  async create(input) {
    try {
      const repo = await getSpotRepo();
      const spot = await repo.create(input);
      await get().load();
      return spot;
    } catch {
      set({ error: t.common.genericError });
      return null;
    }
  },

  async update(id, changes) {
    try {
      const repo = await getSpotRepo();
      const spot = await repo.update(id, changes);
      await get().load();
      return spot;
    } catch {
      set({ error: t.common.genericError });
      return null;
    }
  },

  async archive(id) {
    try {
      const repo = await getSpotRepo();
      await repo.archive(id);
      await get().load();
      return true;
    } catch {
      set({ error: t.common.genericError });
      return false;
    }
  },
}));
