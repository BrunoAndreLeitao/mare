import { create } from 'zustand';

import { getConditionsRepo, getSessionRepo } from '../db';
import {
  type NewSession,
  type Session,
  type SessionChanges,
  type SessionConditions,
  type SessionListItem,
} from '../db/types';
import { t } from '../i18n';

// Mesmo padrão das outras stores: repo por ação, try/catch → error em todas.
// Reatividade (decisão V3 da Tarefa 7): a lista recarrega em focus/pull; a
// Tarefa 8 chama load() no ponto de composição após cada corrida do worker
// com mudanças — o ponto de composição É o evento; sem emitter, sem polling.
interface SessionsState {
  sessions: SessionListItem[];
  loading: boolean;
  error: string | null;
  lastUsedSpotId: string | null;
  // ponytail: LIMIT 50 fixo — paging por OFFSET quando alguém passar 50 sessões.
  load(): Promise<void>;
  loadLastUsedSpot(): Promise<void>;
  /** Returns the created session, or null on failure (error is set). */
  create(input: NewSession): Promise<Session | null>;
  /** Edita e recarrega a lista. Returns the updated session, or null on failure (error is set). */
  update(id: string, changes: SessionChanges): Promise<Session | null>;
  /** "Tentar de novo": resetRetries + reload. Returns false on failure. */
  retryConditions(sessionId: string): Promise<boolean>;
  /** Detalhe: condições completas de uma sessão (null em falha; error é setado). */
  getConditions(sessionId: string): Promise<SessionConditions | null>;
}

export const useSessionsStore = create<SessionsState>()((set, get) => ({
  sessions: [],
  loading: false,
  error: null,
  lastUsedSpotId: null,

  async load() {
    set({ loading: true, error: null });
    try {
      const repo = await getSessionRepo();
      set({ sessions: await repo.listWithDetails(50, 0), loading: false });
    } catch {
      set({ loading: false, error: t.common.genericError });
    }
  },

  async retryConditions(sessionId) {
    try {
      const repo = await getConditionsRepo();
      await repo.resetRetries(sessionId);
      await get().load(); // o cartão volta a "a obter…"; o refetch real é da Tarefa 8
      return true;
    } catch {
      set({ error: t.common.genericError });
      return false;
    }
  },

  async getConditions(sessionId) {
    try {
      const repo = await getConditionsRepo();
      return await repo.getBySessionId(sessionId);
    } catch {
      set({ error: t.common.genericError });
      return null;
    }
  },

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

  async update(id, changes) {
    try {
      const repo = await getSessionRepo();
      const session = await repo.update(id, changes);
      set({ error: null });
      // lastUsedSpotId não é tocado aqui de propósito: "último usado" é uma
      // preocupação do registo de nova sessão, editar não é "usar" um spot.
      // A invalidação de condições (Regra 3) é do repo; aqui só refletimos o
      // resultado — o load garante lista e detalhe frescos ao voltar.
      await get().load();
      return session;
    } catch {
      set({ error: t.common.genericError });
      return null;
    }
  },
}));
