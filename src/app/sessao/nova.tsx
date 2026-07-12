import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Button, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { type Rating } from '../../db/types';
import { t } from '../../i18n';
import { runPendingQueue } from '../../services/openmeteo/runner';
import { fmtLocal } from '../../utils/format';
import { useBoardsStore } from '../../stores/boardsStore';
import { useSessionsStore } from '../../stores/sessionsStore';
import { useSpotsStore } from '../../stores/spotsStore';

const OFFSETS = [0, 1, 2, 3] as const;
const DURATIONS = [30, 60, 90, 120] as const;
const MAX_PAST_DAYS = 92; // teto do past_days da Open-Meteo (docs/OPEN_METEO.md §4)

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress(): void;
}) {
  return (
    <Pressable style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

export default function NewSessionScreen() {
  const spots = useSpotsStore((s) => s.spots);
  const loadSpots = useSpotsStore((s) => s.load);
  const boards = useBoardsStore((s) => s.boards);
  const loadBoards = useBoardsStore((s) => s.load);
  const createSession = useSessionsStore((s) => s.create);
  const storeError = useSessionsStore((s) => s.error);
  const lastUsedSpotId = useSessionsStore((s) => s.lastUsedSpotId);
  const loadLastUsedSpot = useSessionsStore((s) => s.loadLastUsedSpot);

  const [spotId, setSpotId] = useState<string | null>(null);
  const [offsetH, setOffsetH] = useState<number | null>(0); // null = hora custom
  const [customDate, setCustomDate] = useState<Date | null>(null);
  const [pickerStep, setPickerStep] = useState<'date' | 'time' | null>(null);
  const [pickerDraft, setPickerDraft] = useState<Date>(new Date());
  const [rating, setRating] = useState<Rating | null>(null);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  // Erro de VALIDAÇÃO (dono: o campo) — renderiza sob as estrelas. O erro de
  // SISTEMA (dono: o submit) é o storeError, renderizado junto ao botão.
  const [validationError, setValidationError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const ratingY = useRef(0);

  useEffect(() => {
    void loadSpots();
    void loadBoards();
    void loadLastUsedSpot();
  }, [loadSpots, loadBoards, loadLastUsedSpot]);

  // Pré-seleção: último usado se ainda ativo, senão o primeiro da lista.
  useEffect(() => {
    if (spotId === null && spots.length > 0) {
      const lastUsed = spots.find((s) => s.id === lastUsedSpotId);
      setSpotId((lastUsed ?? spots[0]).id);
    }
  }, [spots, lastUsedSpotId, spotId]);

  function onPickerValueChange(_event: DateTimePickerChangeEvent, picked: Date) {
    if (pickerStep === 'date') {
      setPickerDraft(picked);
      setPickerStep('time'); // Android: data e hora em dois passos
      return;
    }
    setCustomDate(picked);
    setOffsetH(null);
    setPickerStep(null);
  }

  function startedAtEpoch(): number {
    if (customDate !== null && offsetH === null) {
      return Math.floor(customDate.getTime() / 1000);
    }
    return Math.floor(Date.now() / 1000) - (offsetH ?? 0) * 3_600;
  }

  async function submit() {
    if (spotId === null) return;
    if (rating === null) {
      setValidationError(t.sessions.ratingRequired);
      // O erro vai ter com o utilizador, não o contrário.
      scrollRef.current?.scrollTo({ y: ratingY.current, animated: true });
      return;
    }
    setValidationError(null);
    const trimmedNotes = notes.trim();
    const session = await createSession({
      spotId,
      boardId: boardId ?? undefined,
      startedAt: startedAtEpoch(),
      rating,
      durationMin: duration ?? undefined,
      notes: trimmedNotes === '' ? undefined : trimmedNotes,
    });
    if (session !== null) {
      // Trigger 4 (extensão ao §6 aprovada): registar É o momento em que o
      // utilizador quer as condições; a guarda singleFlight torna-o seguro.
      runPendingQueue().catch((e) => console.warn('[worker] trigger pós-create:', e));
      router.back();
    }
  }

  if (spots.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.empty}>{t.sessions.noSpots}</Text>
        <Button title={t.spots.create} onPress={() => router.push('/spot/novo')} />
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.label}>{t.sessions.spot}</Text>
      <View style={styles.chips}>
        {spots.map((spot) => (
          <Chip
            key={spot.id}
            label={spot.name}
            selected={spotId === spot.id}
            onPress={() => setSpotId(spot.id)}
          />
        ))}
      </View>

      <Text style={styles.label}>{t.sessions.when}</Text>
      <View style={styles.chips}>
        {OFFSETS.map((h) => (
          <Chip
            key={h}
            label={h === 0 ? t.sessions.now : t.sessions.hoursAgo(h)}
            selected={offsetH === h}
            onPress={() => {
              setOffsetH(h);
              setCustomDate(null);
            }}
          />
        ))}
        <Chip
          label={t.sessions.otherTime}
          selected={offsetH === null}
          onPress={() => {
            setPickerDraft(customDate ?? new Date());
            setPickerStep('date');
          }}
        />
      </View>
      <Text style={styles.whenPreview}>{fmtLocal(new Date(startedAtEpoch() * 1000))}</Text>
      {pickerStep !== null && (
        <DateTimePicker
          value={pickerDraft}
          mode={pickerStep}
          maximumDate={new Date()}
          minimumDate={new Date(Date.now() - MAX_PAST_DAYS * 86_400_000)}
          onValueChange={onPickerValueChange}
          onDismiss={() => setPickerStep(null)}
        />
      )}

      <View onLayout={(e) => (ratingY.current = e.nativeEvent.layout.y)}>
        <Text style={styles.label}>{t.sessions.rating}</Text>
        <View style={styles.stars}>
          {([1, 2, 3, 4, 5] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => {
                setRating(value);
                setValidationError(null);
              }}
              hitSlop={6}
            >
              <Ionicons
                name={rating !== null && value <= rating ? 'star' : 'star-outline'}
                size={40}
                color={rating !== null && value <= rating ? '#f5a623' : '#bbb'}
              />
            </Pressable>
          ))}
        </View>
        {validationError !== null && <Text style={styles.error}>{validationError}</Text>}
      </View>

      {boards.length > 0 && (
        <>
          <Text style={styles.label}>{t.sessions.board}</Text>
          <View style={styles.chips}>
            <Chip
              label={t.sessions.boardNone}
              selected={boardId === null}
              onPress={() => setBoardId(null)}
            />
            {boards.map((board) => (
              <Chip
                key={board.id}
                label={board.name}
                selected={boardId === board.id}
                onPress={() => setBoardId(board.id)}
              />
            ))}
          </View>
        </>
      )}

      <Text style={styles.label}>{t.sessions.duration}</Text>
      <View style={styles.chips}>
        {DURATIONS.map((min) => (
          <Chip
            key={min}
            label={String(min)}
            selected={duration === min}
            // Toggle deliberado (sem chip "—"): limpar duração é corrigir um
            // toque acidental, sem peso semântico — ruído a menos no ecrã.
            onPress={() => setDuration(duration === min ? null : min)}
          />
        ))}
      </View>

      <Text style={styles.label}>{t.sessions.notes}</Text>
      <TextInput
        style={[styles.input, styles.notes]}
        value={notes}
        onChangeText={setNotes}
        placeholder={t.sessions.notesPlaceholder}
        multiline
      />

      {storeError !== null && <Text style={styles.error}>{storeError}</Text>}
      <Button title={t.sessions.register} onPress={submit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  empty: { textAlign: 'center', color: '#666' },
  label: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipSelected: { backgroundColor: '#208AEF', borderColor: '#208AEF' },
  chipLabel: { fontSize: 14 },
  chipLabelSelected: { color: '#fff' },
  whenPreview: { color: '#666', fontSize: 13 },
  stars: { flexDirection: 'row', gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  notes: { minHeight: 80, textAlignVertical: 'top' },
  error: { color: '#c0392b' },
});
