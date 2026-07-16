import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { type SessionConditions } from '../../db/types';
import { t } from '../../i18n';
import { useSessionsStore } from '../../stores/sessionsStore';
import { degToCardinal } from '../../utils/directions';
import { fmtLocal } from '../../utils/format';
import { colors, font, radius, space } from '../../theme';

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

  useFocusEffect(
    useCallback(() => {
      if (id !== undefined) {
        void getConditions(id).then(setConditions);
      }
    }, [id, getConditions]),
  );

  // Só alcançável a partir da lista, que carrega a store.
  if (session === undefined) {
    return null;
  }

  const meta = [session.boardName, session.durationMin !== null ? `${session.durationMin} min` : null]
    .filter((m) => m !== null)
    .join(' · ');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push(`/sessao/editar/${session.id}`)} hitSlop={8}>
              <Ionicons name="create-outline" size={22} color={colors.ink} />
            </Pressable>
          ),
        }}
      />
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
              color={v <= session.rating ? colors.accent : colors.starEmpty}
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
  container: { padding: space.md, gap: space.sm, backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  spotName: { fontFamily: font.displaySemiBold, fontSize: 26, color: colors.ink },
  when: { fontFamily: font.body, fontSize: 14, color: colors.inkMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stars: { flexDirection: 'row', gap: 2 },
  meta: { fontFamily: font.body, fontSize: 14, color: colors.inkMuted },
  notes: { fontFamily: font.body, fontSize: 14, color: colors.ink, fontStyle: 'italic' },
  sectionTitle: { fontFamily: font.bodySemiBold, fontSize: 16, color: colors.ink, marginTop: space.sm },
  quiet: { fontFamily: font.body, fontStyle: 'italic', fontSize: 14, color: colors.pending },
  failedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  retry: { fontFamily: font.bodySemiBold, fontSize: 14, color: colors.accent, textDecorationLine: 'underline' },
  grid: {
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: space.md,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontFamily: font.body, fontSize: 14, color: colors.inkMuted },
  rowValue: { fontFamily: font.monoMedium, fontSize: 14, color: colors.ink },
});
