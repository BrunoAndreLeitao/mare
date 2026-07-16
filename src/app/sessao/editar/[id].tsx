import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { SessionForm } from '../../../components/SessionForm';
import { t } from '../../../i18n';
import { runPendingQueue } from '../../../services/openmeteo/runner';
import { useBoardsStore } from '../../../stores/boardsStore';
import { useSessionsStore } from '../../../stores/sessionsStore';
import { useSpotsStore } from '../../../stores/spotsStore';

export default function EditSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSessionsStore((s) => s.sessions.find((x) => x.id === id));
  const updateSession = useSessionsStore((s) => s.update);
  const storeError = useSessionsStore((s) => s.error);
  const spots = useSpotsStore((s) => s.spots);
  const loadSpots = useSpotsStore((s) => s.load);
  const boards = useBoardsStore((s) => s.boards);
  const loadBoards = useBoardsStore((s) => s.load);

  useEffect(() => {
    void loadSpots();
    void loadBoards();
  }, [loadSpots, loadBoards]);

  // Só alcançável a partir do detalhe, que lê da lista carregada.
  if (session === undefined) {
    return null;
  }

  return (
    <SessionForm
      spots={spots}
      boards={boards}
      initial={{
        spotId: session.spotId,
        startedAt: session.startedAt,
        rating: session.rating,
        boardId: session.boardId,
        durationMin: session.durationMin,
        notes: session.notes,
      }}
      submitLabel={t.common.save}
      externalError={storeError}
      onSubmit={async (values) => {
        // null-clear deliberado (semântica SessionChanges): o formulário edita
        // todos os campos, por isso null aqui significa "limpo pelo utilizador".
        const updated = await updateSession(session.id, {
          spotId: values.spotId,
          startedAt: values.startedAt,
          rating: values.rating,
          boardId: values.boardId,
          durationMin: values.durationMin,
          notes: values.notes,
        });
        if (updated !== null) {
          // Espelho do trigger 4 de nova.tsx: se o update invalidou condições
          // (Regra 3, decidida no repo), o worker refaz o fetch já — a guarda
          // singleFlight torna a chamada segura mesmo sem invalidação.
          runPendingQueue().catch((e) => console.warn('[worker] trigger pós-edit:', e));
          router.back();
        }
      }}
    />
  );
}
