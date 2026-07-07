import { create } from 'zustand';

import { getBoardRepo } from '../db';
import { type Board, type BoardChanges, type NewBoard } from '../db/types';
import { t } from '../i18n';

// Mirror of spotsStore: repo fetched per action (getDatabase caches), mutations
// reload listActive to keep the NOCASE ordering, and every action catches and
// writes error — no repo throw ever reaches an onPress.
interface BoardsState {
  boards: Board[];
  loading: boolean;
  error: string | null;
  load(): Promise<void>;
  /** Returns the created board, or null on failure (error is set). */
  create(input: NewBoard): Promise<Board | null>;
  /** Returns the updated board, or null on failure (error is set). */
  update(id: string, changes: BoardChanges): Promise<Board | null>;
  /** Returns false on failure (error is set). */
  archive(id: string): Promise<boolean>;
}

export const useBoardsStore = create<BoardsState>()((set, get) => ({
  boards: [],
  loading: false,
  error: null,

  async load() {
    set({ loading: true, error: null });
    try {
      const repo = await getBoardRepo();
      set({ boards: await repo.listActive(), loading: false });
    } catch {
      set({ loading: false, error: t.common.genericError });
    }
  },

  async create(input) {
    try {
      const repo = await getBoardRepo();
      const board = await repo.create(input);
      await get().load();
      return board;
    } catch {
      set({ error: t.common.genericError });
      return null;
    }
  },

  async update(id, changes) {
    try {
      const repo = await getBoardRepo();
      const board = await repo.update(id, changes);
      await get().load();
      return board;
    } catch {
      set({ error: t.common.genericError });
      return null;
    }
  },

  async archive(id) {
    try {
      const repo = await getBoardRepo();
      await repo.archive(id);
      await get().load();
      return true;
    } catch {
      set({ error: t.common.genericError });
      return false;
    }
  },
}));
