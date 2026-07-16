import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SessionForm } from '../../components/SessionForm';
import { t } from '../../i18n';
import { runPendingQueue } from '../../services/openmeteo/runner';
import { useBoardsStore } from '../../stores/boardsStore';
import { useSessionsStore } from '../../stores/sessionsStore';
import { useSpotsStore } from '../../stores/spotsStore';
import { colors, font, radius, space } from '../../theme';

export default function NewSessionScreen() {
  const spots = useSpotsStore((s) => s.spots);
  const loadSpots = useSpotsStore((s) => s.load);
  const boards = useBoardsStore((s) => s.boards);
  const loadBoards = useBoardsStore((s) => s.load);
  const createSession = useSessionsStore((s) => s.create);
  const storeError = useSessionsStore((s) => s.error);
  const lastUsedSpotId = useSessionsStore((s) => s.lastUsedSpotId);
  const loadLastUsedSpot = useSessionsStore((s) => s.loadLastUsedSpot);

  useEffect(() => {
    void loadSpots();
    void loadBoards();
    void loadLastUsedSpot();
  }, [loadSpots, loadBoards, loadLastUsedSpot]);

  if (spots.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.empty}>{t.sessions.noSpots}</Text>
        <Pressable style={styles.registerButton} onPress={() => router.push('/spot/novo')}>
          <Text style={styles.registerButtonLabel}>{t.spots.create}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SessionForm
      spots={spots}
      boards={boards}
      defaultSpotId={lastUsedSpotId}
      submitLabel={t.sessions.register}
      externalError={storeError}
      onSubmit={async (values) => {
        const session = await createSession({
          spotId: values.spotId,
          boardId: values.boardId ?? undefined,
          startedAt: values.startedAt,
          rating: values.rating,
          durationMin: values.durationMin ?? undefined,
          notes: values.notes ?? undefined,
        });
        if (session !== null) {
          // Trigger 4 (extensão ao §6 aprovada): registar É o momento em que o
          // utilizador quer as condições; a guarda singleFlight torna-o seguro.
          runPendingQueue().catch((e) => console.warn('[worker] trigger pós-create:', e));
          router.back();
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    padding: space.lg,
    backgroundColor: colors.background,
  },
  empty: { textAlign: 'center', fontFamily: font.body, color: colors.inkMuted },
  registerButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.input,
    paddingVertical: 14,
    paddingHorizontal: space.xl,
    alignItems: 'center',
  },
  registerButtonLabel: { fontFamily: font.bodySemiBold, fontSize: 16, color: colors.accentOn },
});
