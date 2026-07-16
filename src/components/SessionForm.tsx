import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { type Board, type Rating, type Spot } from '../db/types';
import { t } from '../i18n';
import { fmtLocal } from '../utils/format';
import { colors, font, radius, space } from '../theme';

const OFFSETS = [0, 1, 2, 3] as const;
const DURATIONS = [30, 60, 90, 120] as const;
const MAX_PAST_DAYS = 92; // teto do past_days da Open-Meteo (docs/OPEN_METEO.md §4)

export interface SessionFormValues {
  spotId: string;
  startedAt: number; // epoch seconds UTC
  rating: Rating;
  boardId: string | null;
  durationMin: number | null;
  notes: string | null;
}

interface Props {
  spots: Spot[];
  boards: Board[];
  /** Pré-seleção quando não há `initial` (último spot usado); com `initial` é ignorado. */
  defaultSpotId?: string | null;
  initial?: SessionFormValues;
  submitLabel: string;
  /** Erro de SISTEMA (dono: o submit do ecrã) — renderizado junto ao botão. */
  externalError?: string | null;
  onSubmit(values: SessionFormValues): Promise<void>;
}

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

export function SessionForm({
  spots,
  boards,
  defaultSpotId,
  initial,
  submitLabel,
  externalError,
  onSubmit,
}: Props) {
  const [spotId, setSpotId] = useState<string | null>(initial?.spotId ?? null);
  // Em edição, a hora entra como data custom selecionada (offsetH=null).
  const [offsetH, setOffsetH] = useState<number | null>(initial !== undefined ? null : 0);
  const [customDate, setCustomDate] = useState<Date | null>(
    initial !== undefined ? new Date(initial.startedAt * 1000) : null,
  );
  const [pickerStep, setPickerStep] = useState<'date' | 'time' | null>(null);
  const [pickerDraft, setPickerDraft] = useState<Date>(new Date());
  const [rating, setRating] = useState<Rating | null>(initial?.rating ?? null);
  const [boardId, setBoardId] = useState<string | null>(initial?.boardId ?? null);
  const [duration, setDuration] = useState<number | null>(initial?.durationMin ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  // Erro de VALIDAÇÃO (dono: o campo) — renderiza sob as estrelas. O erro de
  // SISTEMA (dono: o submit) é o externalError, renderizado junto ao botão.
  const [validationError, setValidationError] = useState<string | null>(null);
  // Guarda contra double-submit: sem isto, um duplo-toque cria sessão
  // duplicada (criar) ou dispara router.back() duas vezes (editar).
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const ratingY = useRef(0);

  // Pré-seleção: último usado se ainda ativo, senão o primeiro da lista.
  useEffect(() => {
    if (spotId === null && spots.length > 0) {
      const preferred = spots.find((s) => s.id === defaultSpotId);
      setSpotId((preferred ?? spots[0]).id);
    }
  }, [spots, defaultSpotId, spotId]);

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
    if (submitting) return; // já em curso — ignora o segundo toque
    setValidationError(null);
    const trimmedNotes = notes.trim();
    setSubmitting(true);
    try {
      await onSubmit({
        spotId,
        startedAt: startedAtEpoch(),
        rating,
        boardId,
        durationMin: duration,
        notes: trimmedNotes === '' ? null : trimmedNotes,
      });
    } finally {
      setSubmitting(false);
    }
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
                color={rating !== null && value <= rating ? colors.accent : colors.starEmpty}
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
        placeholderTextColor={colors.inkMuted}
        multiline
      />

      {externalError != null && <Text style={styles.error}>{externalError}</Text>}
      <Pressable
        style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
        onPress={() => void submit()}
        disabled={submitting}
      >
        <Text style={styles.submitButtonLabel}>{submitLabel}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.md, gap: space.sm, backgroundColor: colors.background },
  label: {
    fontFamily: font.bodySemiBold,
    fontSize: 13,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: space.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.chip,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipLabel: { fontFamily: font.body, fontSize: 14, color: colors.ink },
  chipLabelSelected: { fontFamily: font.bodySemiBold, color: colors.accentOn },
  whenPreview: { fontFamily: font.mono, color: colors.inkMuted, fontSize: 13 },
  stars: { flexDirection: 'row', gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: font.body,
    fontSize: 16,
    color: colors.ink,
  },
  notes: { minHeight: 80, textAlignVertical: 'top', fontStyle: 'italic' },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.input,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: space.sm,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonLabel: { fontFamily: font.bodySemiBold, fontSize: 16, color: colors.accentOn },
  error: { fontFamily: font.body, color: colors.error },
});
