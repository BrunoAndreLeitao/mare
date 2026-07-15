import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { type BoardType } from '../db/types';
import { t } from '../i18n';
import { parseDecimal } from '../utils/coords';
import { colors, font, radius, space } from '../theme';

export interface BoardFormValues {
  name: string;
  boardType: BoardType | null;
  volumeL: number | null;
}

interface Props {
  initial?: BoardFormValues;
  submitLabel: string;
  /** Store/screen error rendered alongside local validation errors. */
  externalError?: string | null;
  onSubmit(values: BoardFormValues): void;
}

const typeOptions = Object.entries(t.boards.types) as [BoardType, string][];

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

export function BoardForm({ initial, submitLabel, externalError, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [boardType, setBoardType] = useState<BoardType | null>(initial?.boardType ?? null);
  const [volume, setVolume] = useState(
    initial === undefined || initial.volumeL === null ? '' : String(initial.volumeL),
  );
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (name.trim() === '') {
      setError(`${t.boards.name}: ${t.common.required}`);
      return;
    }
    let volumeL: number | null = null;
    if (volume.trim() !== '') {
      const parsed = parseDecimal(volume);
      if (parsed === null || parsed <= 0) {
        setError(t.boards.volumeInvalid);
        return;
      }
      volumeL = parsed;
    }
    setError(null);
    onSubmit({ name: name.trim(), boardType, volumeL });
  }

  const shownError = error ?? externalError ?? null;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {shownError !== null && <Text style={styles.error}>{shownError}</Text>}

      <Text style={styles.label}>{t.boards.name}</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={t.boards.namePlaceholder}
        placeholderTextColor={colors.inkMuted}
        autoFocus
      />

      <Text style={styles.label}>{t.boards.type}</Text>
      <View style={styles.chips}>
        <Chip
          label={t.boards.typeNone}
          selected={boardType === null}
          onPress={() => setBoardType(null)}
        />
        {typeOptions.map(([value, label]) => (
          <Chip
            key={value}
            label={label}
            selected={boardType === value}
            onPress={() => setBoardType(value)}
          />
        ))}
      </View>

      <Text style={styles.label}>{t.boards.volume}</Text>
      <TextInput
        style={styles.input}
        value={volume}
        onChangeText={setVolume}
        keyboardType="decimal-pad"
      />

      <Pressable style={styles.submitButton} onPress={submit}>
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
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.input,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: space.sm,
  },
  submitButtonLabel: { fontFamily: font.bodySemiBold, fontSize: 16, color: colors.accentOn },
  error: { fontFamily: font.body, color: colors.error },
});
