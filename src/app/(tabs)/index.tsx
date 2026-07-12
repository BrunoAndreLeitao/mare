import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Button, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { type SessionListItem } from '../../db/types';
import { t } from '../../i18n';
import { runPendingQueue } from '../../services/openmeteo/runner';
import { useSessionsStore } from '../../stores/sessionsStore';
import { degToCardinal } from '../../utils/directions';
import { fmtLocal } from '../../utils/format';

// Campo em falta DENTRO de linha renderizada mostra "—" (ausência explícita,
// não silenciosa); linha inteira em falta não renderiza.
const DASH = '—';

function Stars({ rating }: { rating: number }) {
  return (
    <View style={styles.stars}>
      {([1, 2, 3, 4, 5] as const).map((v) => (
        <Ionicons
          key={v}
          name={v <= rating ? 'star' : 'star-outline'}
          size={14}
          color={v <= rating ? '#f5a623' : '#ccc'}
        />
      ))}
    </View>
  );
}

function ConditionsZone({
  item,
  onRetry,
}: {
  item: SessionListItem;
  onRetry(id: string): void;
}) {
  if (item.fetchStatus === 'pending') {
    return <Text style={styles.condQuiet}>{t.sessions.conditionsPending}</Text>;
  }
  if (item.fetchStatus === 'failed') {
    return (
      <View style={styles.failedRow}>
        <Text style={styles.condQuiet}>{t.sessions.conditionsUnavailable}</Text>
        <Pressable onPress={() => onRetry(item.id)} hitSlop={8}>
          <Text style={styles.retry}>{t.sessions.retryFetch}</Text>
        </Pressable>
      </View>
    );
  }
  // ok — duas linhas: SINAL (swell + período) destacado; CONTEXTO (vento +
  // maré) em cinza. O período é a variável discriminante do spot (Fase 4).
  const hasSignal = item.swellHeightM !== null || item.swellPeriodS !== null;
  const hasContext = item.windSpeedKmh !== null || item.tidePhase !== null;
  return (
    <View>
      {hasSignal && (
        <Text style={styles.condSignal}>
          {item.swellHeightM !== null ? `${item.swellHeightM} m` : DASH}
          {' · '}
          {item.swellPeriodS !== null ? `${item.swellPeriodS} s` : DASH}
        </Text>
      )}
      {hasContext && (
        <Text style={styles.condContext}>
          {item.windSpeedKmh !== null
            ? `${item.windSpeedKmh} km/h${item.windDirectionDeg !== null ? ` ${degToCardinal(item.windDirectionDeg)}` : ''}`
            : DASH}
          {' · '}
          {item.tidePhase !== null ? t.sessions.tide[item.tidePhase] : DASH}
        </Text>
      )}
    </View>
  );
}

function SessionCard({
  item,
  onRetry,
}: {
  item: SessionListItem;
  onRetry(id: string): void;
}) {
  const meta = [item.boardName, item.durationMin !== null ? `${item.durationMin} min` : null]
    .filter((m) => m !== null)
    .join(' · ');
  return (
    <Pressable style={styles.card} onPress={() => router.push(`/sessao/${item.id}`)}>
      <View style={styles.headerRow}>
        <Text style={styles.spotName}>{item.spotName}</Text>
        <Text style={styles.when}>{fmtLocal(new Date(item.startedAt * 1000))}</Text>
      </View>
      <View style={styles.metaRow}>
        <Stars rating={item.rating} />
        {meta !== '' && <Text style={styles.meta}>{meta}</Text>}
      </View>
      <ConditionsZone item={item} onRetry={onRetry} />
    </Pressable>
  );
}

export default function SessionsScreen() {
  const sessions = useSessionsStore((s) => s.sessions);
  const error = useSessionsStore((s) => s.error);
  const load = useSessionsStore((s) => s.load);
  const retryConditions = useSessionsStore((s) => s.retryConditions);
  const [refreshing, setRefreshing] = useState(false);

  // Trigger 3: pull-to-refresh corre o worker E recarrega (o load final
  // garante lista fresca mesmo sem mudanças); spinner cobre a corrida toda.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await runPendingQueue();
    } catch (e) {
      console.warn('[worker] trigger pull:', e);
    }
    await load();
    setRefreshing(false);
  }, [load]);

  // Reatividade V3: recarrega ao ganhar foco (voltar do registo mostra a
  // sessão nova sem gesto). Limitação conhecida até à Tarefa 8: mudanças do
  // worker com a lista em foco só aparecem ao sair/voltar ou pull.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={styles.container}>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        contentContainerStyle={sessions.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          <View style={styles.emptyBody}>
            <Text style={styles.emptyTitle}>{t.sessions.emptyTitle}</Text>
            <Text style={styles.emptyText}>{t.sessions.emptyBody}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <SessionCard item={item} onRetry={(id) => void retryConditions(id)} />
        )}
      />
      <View style={styles.footer}>
        <Button title={t.sessions.register} onPress={() => router.push('/sessao/nova')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyContainer: { flex: 1 },
  emptyBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#666' },
  card: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
    gap: 4,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  spotName: { fontSize: 16, fontWeight: '600' },
  when: { fontSize: 13, color: '#666' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stars: { flexDirection: 'row', gap: 1 },
  meta: { fontSize: 13, color: '#666' },
  condQuiet: { fontSize: 13, color: '#888' },
  condSignal: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  condContext: { fontSize: 13, color: '#666' },
  failedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  retry: { fontSize: 13, color: '#208AEF', fontWeight: '600' },
  footer: { padding: 16 },
  error: { color: '#c0392b', padding: 16 },
});
