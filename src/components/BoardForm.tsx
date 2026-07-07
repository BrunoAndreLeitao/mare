import { useState } from 'react';
import { Button, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { type BoardType } from '../db/types';
import { t } from '../i18n';
import { parseDecimal } from '../utils/coords';

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

      <Button title={submitLabel} onPress={submit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
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
  error: { color: '#c0392b' },
});
