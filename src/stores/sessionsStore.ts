import { create } from 'zustand';

import { getSessionRepo } from '../db';
import { type NewSession, type Session } from '../db/types';
import { t } from '../i18n';

// Mesmo padrão das outras stores: repo por ação, try/catch → error em todas.
// Sem lista — o histórico (listWithDetails) nasce na Tarefa 7.
interface SessionsState {
  error: string | null;
  lastUsedSpotId: string | null;
  loadLastUsedSpot(): Promise<void>;
  /** Returns the created session, or null on failure (error is set). */
  create(input: NewSession): Promise<Session | null>;
}

export const useSessionsStore = create<SessionsState>()((set) => ({
  error: null,
  lastUsedSpotId: null,

  async loadLastUsedSpot() {
    try {
      const repo = await getSessionRepo();
      set({ lastUsedSpotId: await repo.getLastUsedSpotId() });
    } catch {
      // Pré-seleção é conveniência: falhar aqui não bloqueia o registo.
      set({ lastUsedSpotId: null });
    }
  },

  async create(input) {
    try {
      const repo = await getSessionRepo();
      const session = await repo.create(input);
      set({ error: null, lastUsedSpotId: session.spotId });
      return session;
    } catch {
      set({ error: t.common.genericError });
      return null;
    }
  },
}));
