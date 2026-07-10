import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { type SessionConditions } from '../../db/types';
import { t } from '../../i18n';
import { useSessionsStore } from '../../stores/sessionsStore';
import { degToCardinal } from '../../utils/directions';
import { fmtLocal } from '../../utils/format';

const DASH = '—';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const num = (v: number | null, unit: string) => (v !== null ? `${v} ${unit}` : DASH);
const dir = (v: number | null) => (v !== null ? `${degToCardinal(v)} (${v}°)` : DASH);

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSessionsStore((s) => s.sessions.find((x) => x.id === id));
  const getConditions = useSessionsStore((s) => s.getConditions);
  const retryConditions = useSessionsStore((s) => s.retryConditions);
  const [conditions, setConditions] = useState<SessionConditions | null>(null);

  useEffect(() => {
    if (id !== undefined) {
      void getConditions(id).then(setConditions);
    }
  }, [id, getConditions]);

  // Só alcançável a partir da lista, que carrega a store.
  if (session === undefined) {
    return null;
  }

  const meta = [session.boardName, session.durationMin !== null ? `${session.durationMin} min` : null]
    .filter((m) => m !== null)
    .join(' · ');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.spotName}>{session.spotName}</Text>
        <Text style={styles.when}>{fmtLocal(new Date(session.startedAt * 1000))}</Text>
      </View>
      <View style={styles.metaRow}>
        <View style={styles.stars}>
          {([1, 2, 3, 4, 5] as const).map((v) => (
            <Ionicons
              key={v}
              name={v <= session.rating ? 'star' : 'star-outline'}
              size={20}
              color={v <= session.rating ? '#f5a623' : '#ccc'}
            />
          ))}
        </View>
        {meta !== '' && <Text style={styles.meta}>{meta}</Text>}
      </View>
      {session.notes !== null && <Text style={styles.notes}>{session.notes}</Text>}

      <Text style={styles.sectionTitle}>{t.sessions.conditionsTitle}</Text>
      {conditions === null || conditions.fetchStatus === 'pending' ? (
        <Text style={styles.quiet}>{t.sessions.conditionsPending}</Text>
      ) : conditions.fetchStatus === 'failed' ? (
        <View style={styles.failedRow}>
          <Text style={styles.quiet}>{t.sessions.conditionsUnavailable}</Text>
          <Pressable
            onPress={() => {
              void retryConditions(session.id).then(() => getConditions(session.id).then(setConditions));
            }}
            hitSlop={8}
          >
            <Text style={styles.retry}>{t.sessions.retryFetch}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.grid}>
          <Row label={t.sessions.detail.swell} value={num(conditions.swellHeightM, 'm')} />
          <Row label={t.sessions.detail.period} value={num(conditions.swellPeriodS, 's')} />
          <Row label={t.sessions.detail.peakPeriod} value={num(conditions.swellPeakPeriodS, 's')} />
          <Row label={t.sessions.detail.swellDirection} value={dir(conditions.swellDirectionDeg)} />
          <Row label={t.sessions.detail.wave} value={num(conditions.waveHeightM, 'm')} />
          <Row label={t.sessions.detail.windWave} value={num(conditions.windWaveHeightM, 'm')} />
          <Row label={t.sessions.detail.wind} value={num(conditions.windSpeedKmh, 'km/h')} />
          <Row label={t.sessions.detail.gusts} value={num(conditions.windGustsKmh, 'km/h')} />
          <Row label={t.sessions.detail.windDirection} value={dir(conditions.windDirectionDeg)} />
          <Row label={t.sessions.detail.waterTemp} value={num(conditions.waterTempC, '°C')} />
          <Row label={t.sessions.detail.seaLevel} value={num(conditions.seaLevelMslM, 'm')} />
          <Row
            label={t.sessions.detail.tidePhase}
            value={conditions.tidePhase !== null ? t.sessions.tide[conditions.tidePhase] : DASH}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  spotName: { fontSize: 20, fontWeight: '700' },
  when: { fontSize: 14, color: '#666' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stars: { flexDirection: 'row', gap: 2 },
  meta: { fontSize: 14, color: '#666' },
  notes: { fontSize: 14, color: '#333', fontStyle: 'italic' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  quiet: { fontSize: 14, color: '#888' },
  failedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  retry: { fontSize: 14, color: '#208AEF', fontWeight: '600' },
  grid: { gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontSize: 14, color: '#666' },
  rowValue: { fontSize: 14, fontWeight: '500' },
});
