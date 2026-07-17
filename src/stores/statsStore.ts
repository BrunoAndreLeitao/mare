import { create } from 'zustand';

import { getSessionRepo } from '../db';
import { type SessionStatsRaw } from '../db/types';

// Padrão das outras stores: repo por ação, try/catch. SEM `error` visível:
// falhar as estatísticas não é um erro que o utilizador precise de ver — os
// tiles somem e o histórico funciona na mesma (nunca bloquear a lista por
// causa de um número decorativo).
interface StatsState {
  stats: SessionStatsRaw | null;
  load(): Promise<void>;
}

export const useStatsStore = create<StatsState>()((set) => ({
  stats: null,

  async load() {
    try {
      const repo = await getSessionRepo();
      set({ stats: await repo.getStats() });
    } catch (e) {
      console.warn('[stats] load:', e);
      set({ stats: null });
    }
  },
}));
