import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DirectionArrow, TideIcon } from '../../components/DirectionArrow';
import { type SessionConditions } from '../../db/types';
import { t } from '../../i18n';
import { useSessionsStore } from '../../stores/sessionsStore';
import { degToCardinal } from '../../utils/directions';
import { fmtLocal } from '../../utils/format';
import { type Theme, useTheme, radius, space } from '../../theme';

const DASH = '—';

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function DirRow({ label, deg }: { label: string; deg: number | null }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.valueWithIcon}>
        {deg !== null && <DirectionArrow deg={deg} size={14} color={theme.colors.ink} />}
        <Text style={styles.rowValue}>{deg !== null ? `${degToCardinal(deg)} (${deg}°)` : DASH}</Text>
      </View>
    </View>
  );
}

const num = (v: number | null, unit: string) => (v !== null ? `${v} ${unit}` : DASH);

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSessionsStore((s) => s.sessions.find((x) => x.id === id));
  const getConditions = useSessionsStore((s) => s.getConditions);
  const retryConditions = useSessionsStore((s) => s.retryConditions);
  const [conditions, setConditions] = useState<SessionConditions | null>(null);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

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
              <Ionicons name="create-outline" size={22} color={theme.colors.ink} />
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
              color={v <= session.rating ? theme.colors.accent : theme.colors.starEmpty}
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
          <DirRow label={t.sessions.detail.swellDirection} deg={conditions.swellDirectionDeg} />
          <Row label={t.sessions.detail.wave} value={num(conditions.waveHeightM, 'm')} />
          <Row label={t.sessions.detail.windWave} value={num(conditions.windWaveHeightM, 'm')} />
          <Row label={t.sessions.detail.wind} value={num(conditions.windSpeedKmh, 'km/h')} />
          <Row label={t.sessions.detail.gusts} value={num(conditions.windGustsKmh, 'km/h')} />
          <DirRow label={t.sessions.detail.windDirection} deg={conditions.windDirectionDeg} />
          <Row label={t.sessions.detail.waterTemp} value={num(conditions.waterTempC, '°C')} />
          <Row label={t.sessions.detail.seaLevel} value={num(conditions.seaLevelMslM, 'm')} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t.sessions.detail.tidePhase}</Text>
            <View style={styles.valueWithIcon}>
              {conditions.tidePhase !== null && (
                <TideIcon phase={conditions.tidePhase} size={14} color={theme.colors.ink} />
              )}
              <Text style={styles.rowValue}>
                {conditions.tidePhase !== null ? t.sessions.tide[conditions.tidePhase] : DASH}
              </Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { padding: space.md, gap: space.sm, backgroundColor: theme.colors.background },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    spotName: { fontFamily: theme.font.displaySemiBold, fontSize: 26, color: theme.colors.ink },
    when: { fontFamily: theme.font.body, fontSize: 14, color: theme.colors.inkMuted },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    stars: { flexDirection: 'row', gap: 2 },
    meta: { fontFamily: theme.font.body, fontSize: 14, color: theme.colors.inkMuted },
    notes: { fontFamily: theme.font.body, fontSize: 14, color: theme.colors.ink, fontStyle: 'italic' },
    sectionTitle: { fontFamily: theme.font.bodySemiBold, fontSize: 16, color: theme.colors.ink, marginTop: space.sm },
    quiet: { fontFamily: theme.font.body, fontStyle: 'italic', fontSize: 14, color: theme.colors.pending },
    failedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    retry: { fontFamily: theme.font.bodySemiBold, fontSize: 14, color: theme.colors.accent, textDecorationLine: 'underline' },
    grid: {
      gap: space.sm,
      backgroundColor: theme.colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      padding: space.md,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    rowLabel: { fontFamily: theme.font.body, fontSize: 14, color: theme.colors.inkMuted },
    rowValue: { fontFamily: theme.font.monoMedium, fontSize: 14, color: theme.colors.ink },
    valueWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  });
}
