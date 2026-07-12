import NetInfo from '@react-native-community/netinfo';

import { getConditionsRepo } from '../../db';
import { useSessionsStore } from '../../stores/sessionsStore';
import { singleFlight } from '../../utils/singleFlight';
import { getProvider } from './index';
import { processPendingQueue, type QueueRunResult } from './pendingQueue';

// Ponto de composição do worker: aqui as deps injetadas viram reais e a guarda
// de reentrância protege os 4 triggers (arranque, netinfo, pull, pós-create).
// Reload pós-worker (decisão V3 da Tarefa 7): quando a corrida muda alguma
// coisa, recarrega a store — o ponto de composição É o evento; sem emitter.
export const runPendingQueue: () => Promise<QueueRunResult> = singleFlight(async () => {
  const result = await processPendingQueue({
    conditions: await getConditionsRepo(),
    provider: getProvider(),
    isOnline: async () => (await NetInfo.fetch()).isConnected ?? false,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });
  if (result.ok + result.partial + result.failed > 0) {
    await useSessionsStore.getState().load();
  }
  return result;
});
