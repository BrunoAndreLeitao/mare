import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { DirectionArrow, TideIcon } from '../../components/DirectionArrow';
import { type SessionListItem } from '../../db/types';
import { t } from '../../i18n';
import { runPendingQueue } from '../../services/openmeteo/runner';
import { swellVsAverage } from '../../services/stats/badge';
import { weekStreak } from '../../services/stats/streak';
import { useSessionsStore } from '../../stores/sessionsStore';
import { useSpotsStore } from '../../stores/spotsStore';
import { useStatsStore } from '../../stores/statsStore';
import { degToCardinal } from '../../utils/directions';
import { fmtLocal } from '../../utils/format';
import { type Theme, useTheme, radius, space } from '../../theme';

// Campo em falta DENTRO de linha renderizada mostra "—" (ausência explícita,
// não silenciosa); linha inteira em falta não renderiza.
const DASH = '—';

// O onboarding é por arranque, não por remontagem: sem isto, "Saltar" volta a
// disparar o redirect assim que o ecrã remonta (o critério — sem spots nem
// sessões — continua verdadeiro). Módulo, não state/ref: tem de sobreviver à
// remontagem do ecrã e morrer com o processo, que é o "próximo arranque" da spec.
let redirectedThisLaunch = false;

function Stars({ rating }: { rating: number }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.stars}>
      {([1, 2, 3, 4, 5] as const).map((v) => (
        <Ionicons
          key={v}
          name={v <= rating ? 'star' : 'star-outline'}
          size={14}
          color={v <= rating ? theme.colors.accent : theme.colors.starEmpty}
        />
      ))}
    </View>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

// Cada tile só existe se tiver dado real: zero placeholders, zero "—". Sem
// nada que mostrar, a barra inteira não renderiza.
function StatsBar() {
  const stats = useStatsStore((s) => s.stats);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  if (stats === null) {
    return null;
  }

  const streak = weekStreak(stats.startedAtAll, new Date());
  const top = stats.sessionsBySpot[0] ?? null;
  const tiles = [
    streak > 0 ? { label: t.sessions.stats.streak, value: t.sessions.stats.weeks(streak) } : null,
    stats.record !== null
      ? { label: t.sessions.stats.record, value: `${stats.record.swellHeightM} m · ${stats.record.spotName}` }
      : null,
    top !== null
      ? {
          label: t.sessions.stats.mostSurfed,
          value: `${top.spotName} · ${t.sessions.stats.sessionsCount(top.count)}`,
        }
      : null,
  ].filter((tile) => tile !== null);

  if (tiles.length === 0) {
    return null;
  }
  return (
    <View style={styles.statsBar}>
      {tiles.map((tile) => (
        <StatTile key={tile.label} label={tile.label} value={tile.value} />
      ))}
    </View>
  );
}

function ConditionsZone({
  item,
  pct,
  onRetry,
}: {
  item: SessionListItem;
  pct: number | null;
  onRetry(id: string): void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
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
        <View style={styles.signalRow}>
          <Text style={styles.condSignal}>
            {item.swellHeightM !== null ? `${item.swellHeightM} m` : DASH}
            {' · '}
            {item.swellPeriodS !== null ? `${item.swellPeriodS} s` : DASH}
          </Text>
          {pct !== null && (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>{`+${pct}%`}</Text>
            </View>
          )}
        </View>
      )}
      {hasContext && (
        <View style={styles.contextRow}>
          {item.windSpeedKmh !== null ? (
            <View style={styles.contextItem}>
              {item.windDirectionDeg !== null && (
                <DirectionArrow deg={item.windDirectionDeg} color={theme.colors.inkMuted} />
              )}
              <Text style={styles.condContext}>
                {`${item.windSpeedKmh} km/h${item.windDirectionDeg !== null ? ` ${degToCardinal(item.windDirectionDeg)}` : ''}`}
              </Text>
            </View>
          ) : (
            <Text style={styles.condContext}>{DASH}</Text>
          )}
          <Text style={styles.condContext}>{' · '}</Text>
          {item.tidePhase !== null ? (
            <View style={styles.contextItem}>
              <TideIcon phase={item.tidePhase} color={theme.colors.inkMuted} />
              <Text style={styles.condContext}>{t.sessions.tide[item.tidePhase]}</Text>
            </View>
          ) : (
            <Text style={styles.condContext}>{DASH}</Text>
          )}
        </View>
      )}
    </View>
  );
}

function SessionCard({
  item,
  spotSessions,
  onRetry,
}: {
  item: SessionListItem;
  spotSessions: SessionListItem[];
  onRetry(id: string): void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const meta = [item.boardName, item.durationMin !== null ? `${item.durationMin} min` : null]
    .filter((m) => m !== null)
    .join(' · ');
  const pct = swellVsAverage(item, spotSessions);
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
      <ConditionsZone item={item} pct={pct} onRetry={onRetry} />
    </Pressable>
  );
}

export default function SessionsScreen() {
  const sessions = useSessionsStore((s) => s.sessions);
  const error = useSessionsStore((s) => s.error);
  const load = useSessionsStore((s) => s.load);
  const retryConditions = useSessionsStore((s) => s.retryConditions);
  const loadStats = useStatsStore((s) => s.load);
  const [refreshing, setRefreshing] = useState(false);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const spots = useSpotsStore((s) => s.spots);
  const loadSpots = useSpotsStore((s) => s.load);
  // O gatilho do onboarding só pode julgar DEPOIS de as duas listas terem
  // carregado: ambas nascem vazias e `loading` nasce false, por isso a
  // condição "vazio" é verdade no primeiro render de qualquer utilizador.
  const [loaded, setLoaded] = useState(false);

  // Trigger 3: pull-to-refresh corre o worker E recarrega (o load final
  // garante lista fresca mesmo sem mudanças); spinner cobre a corrida toda.
  // O worker pode transformar uma sessão pendente em recorde — sem recarregar
  // as stats aqui, os tiles ficavam parados enquanto a lista já mudou.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await runPendingQueue();
    } catch (e) {
      console.warn('[worker] trigger pull:', e);
    }
    await Promise.all([load(), loadStats()]);
    setRefreshing(false);
  }, [load, loadStats]);

  // Os spots só interessam aqui para o gatilho do onboarding (a lista em si
  // não os usa) — daí carregarem uma vez, sem focus effect. O load das
  // sessões vive no useFocusEffect abaixo; esperamos pelos dois.
  useEffect(() => {
    // Falha aqui não pode desligar o gatilho para sempre: um load com erro é
    // indistinguível de um vazio para este efeito, e as stores já mostram o
    // erro delas. Sem o catch, um erro no arranque escondia o onboarding a um
    // utilizador novo — silenciosamente, em todos os arranques.
    void Promise.all([loadSpots(), load()]).finally(() => setLoaded(true));
  }, [loadSpots, load]);

  // Utilizador novo = sem spots E sem sessões. A conjunção importa: quem
  // arquive todos os spots mas tenha histórico não é novo. Guarda de módulo
  // (redirectedThisLaunch) garante que isto dispara no máximo uma vez por
  // arranque — sem ela, sair do onboarding remonta este ecrã e o redirect
  // reentra porque o critério continua verdadeiro.
  useEffect(() => {
    if (!redirectedThisLaunch && loaded && spots.length === 0 && sessions.length === 0) {
      redirectedThisLaunch = true;
      router.replace('/onboarding');
    }
  }, [loaded, spots.length, sessions.length]);

  // Reatividade V3: recarrega ao ganhar foco (voltar do registo mostra a
  // sessão nova sem gesto). Limitação conhecida até à Tarefa 8: mudanças do
  // worker com a lista em foco só aparecem ao sair/voltar ou pull.
  useFocusEffect(
    useCallback(() => {
      void load();
      void loadStats();
    }, [load, loadStats]),
  );

  // Enquanto os loads não terminam não sabemos se este é um utilizador novo:
  // mostrar o empty state ("Regista a primeira") a quem vai ser mandado para o
  // onboarding seria uma mensagem errada a piscar. Só afeta o arranque com
  // lista vazia — quem tem sessões vê-as aparecer como antes.
  if (!loaded && sessions.length === 0) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        ListHeaderComponent={sessions.length > 0 ? <StatsBar /> : null}
        contentContainerStyle={sessions.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          <View style={styles.emptyBody}>
            <Ionicons name="water-outline" size={64} color={theme.colors.inkMuted} />
            <Text style={styles.emptyTitle}>{t.sessions.emptyTitle}</Text>
            <Text style={styles.emptyText}>{t.sessions.emptyBody}</Text>
            <Pressable
              style={[styles.registerButton, styles.emptyCta]}
              onPress={() => router.push('/sessao/nova')}
            >
              <Text style={styles.registerButtonLabel}>{t.sessions.register}</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          // Limitação conhecida: spotSessions vem da lista em memória (LIMIT
          // 50), por isso o badge usa a média das últimas ≤50 sessões do
          // spot, não de sempre. Os tiles (getStats) são exatos.
          <SessionCard
            item={item}
            spotSessions={sessions.filter((s) => s.spotId === item.spotId)}
            onRetry={(id) => void retryConditions(id)}
          />
        )}
      />
      {sessions.length > 0 && (
        <View style={styles.footer}>
          <Pressable style={styles.registerButton} onPress={() => router.push('/sessao/nova')}>
            <Text style={styles.registerButtonLabel}>{t.sessions.register}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    emptyContainer: { flex: 1 },
    emptyBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.lg },
    emptyTitle: { fontFamily: theme.font.displayItalic, fontSize: 22, color: theme.colors.ink },
    emptyText: { textAlign: 'center', fontFamily: theme.font.body, fontSize: 15, color: theme.colors.inkMuted },
    emptyCta: { paddingHorizontal: space.xl, marginTop: space.sm },
    statsBar: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm },
    tile: {
      flex: 1,
      padding: space.sm,
      backgroundColor: theme.colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      gap: space.xs2,
    },
    tileValue: { fontFamily: theme.font.monoMedium, fontSize: 15, color: theme.colors.ink },
    tileLabel: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.inkMuted, textTransform: 'uppercase' },
    card: {
      marginHorizontal: space.md,
      marginTop: space.sm,
      padding: space.md,
      backgroundColor: theme.colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      gap: space.xs,
    },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    spotName: { fontFamily: theme.font.displaySemiBold, fontSize: 17, color: theme.colors.ink },
    when: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.inkMuted },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    stars: { flexDirection: 'row', gap: 1 },
    meta: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.inkMuted },
    condQuiet: { fontFamily: theme.font.body, fontStyle: 'italic', fontSize: 13, color: theme.colors.pending },
    condSignal: { fontFamily: theme.font.monoMedium, fontSize: 17, color: theme.colors.ink },
    condContext: { fontFamily: theme.font.mono, fontSize: 13, color: theme.colors.inkMuted },
    contextRow: { flexDirection: 'row', alignItems: 'center' },
    contextItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    failedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    signalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    badge: {
      backgroundColor: theme.colors.accent,
      borderRadius: radius.chip,
      paddingHorizontal: space.sm,
      paddingVertical: space.xs2,
    },
    badgeLabel: { fontFamily: theme.font.bodySemiBold, fontSize: 11, color: theme.colors.accentOn },
    retry: { fontFamily: theme.font.bodySemiBold, fontSize: 13, color: theme.colors.accent, textDecorationLine: 'underline' },
    footer: { padding: space.md },
    registerButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: radius.input,
      paddingVertical: 14,
      alignItems: 'center',
    },
    registerButtonLabel: { fontFamily: theme.font.bodySemiBold, fontSize: 16, color: theme.colors.accentOn },
    error: { fontFamily: theme.font.body, color: theme.colors.error, padding: space.md },
  });
}
