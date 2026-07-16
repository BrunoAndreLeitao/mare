import * as Location from 'expo-location';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { t } from '../i18n';
import { parseDecimal, validateCoords } from '../utils/coords';
import { type Theme, useTheme, radius, space } from '../theme';

export interface SpotFormValues {
  name: string;
  latitude: number;
  longitude: number;
  notes: string | null;
}

interface Props {
  initial?: SpotFormValues;
  submitLabel: string;
  /** Store/screen error rendered alongside local validation errors. */
  externalError?: string | null;
  onSubmit(values: SpotFormValues): void;
}

export function SpotForm({ initial, submitLabel, externalError, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [lat, setLat] = useState(initial !== undefined ? String(initial.latitude) : '');
  const [lon, setLon] = useState(initial !== undefined ? String(initial.longitude) : '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // Permission is requested only here, on tap (CLAUDE.md: no upfront prompts).
  async function fillFromLocation() {
    setLocating(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError(t.spots.locationDenied);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setLat(pos.coords.latitude.toFixed(5));
      setLon(pos.coords.longitude.toFixed(5));
    } catch {
      setError(t.spots.locationFailed);
    } finally {
      setLocating(false);
    }
  }

  function submit() {
    if (name.trim() === '') {
      setError(`${t.spots.name}: ${t.common.required}`);
      return;
    }
    const latitude = parseDecimal(lat);
    const longitude = parseDecimal(lon);
    if (latitude === null || longitude === null) {
      setError(t.spots.coordsNotNumeric);
      return;
    }
    const coordsError = validateCoords(latitude, longitude);
    if (coordsError !== null) {
      setError(t.spots[coordsError]);
      return;
    }
    setError(null);
    const trimmedNotes = notes.trim();
    onSubmit({
      name: name.trim(),
      latitude,
      longitude,
      notes: trimmedNotes === '' ? null : trimmedNotes,
    });
  }

  const shownError = error ?? externalError ?? null;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {shownError !== null && <Text style={styles.error}>{shownError}</Text>}

      <Text style={styles.label}>{t.spots.name}</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={t.spots.namePlaceholder}
        placeholderTextColor={theme.colors.inkMuted}
        autoFocus
      />

      <Text style={styles.label}>{t.spots.latitude}</Text>
      <TextInput
        style={styles.input}
        value={lat}
        onChangeText={setLat}
        // numbers-and-punctuation: PT longitudes are negative and iOS
        // decimal-pad has no minus sign; Android falls back to default.
        keyboardType="numbers-and-punctuation"
      />

      <Text style={styles.label}>{t.spots.longitude}</Text>
      <TextInput
        style={styles.input}
        value={lon}
        onChangeText={setLon}
        keyboardType="numbers-and-punctuation"
      />

      <Pressable
        onPress={() => void fillFromLocation()}
        disabled={locating}
        style={locating && styles.linkDisabled}
        hitSlop={8}
      >
        <Text style={styles.link}>{t.spots.useMyLocation}</Text>
      </Pressable>

      <Text style={styles.label}>{t.spots.notes}</Text>
      <TextInput
        style={[styles.input, styles.notes]}
        value={notes}
        onChangeText={setNotes}
        placeholder={t.spots.notesPlaceholder}
        placeholderTextColor={theme.colors.inkMuted}
        multiline
      />

      <Pressable style={styles.submitButton} onPress={submit}>
        <Text style={styles.submitButtonLabel}>{submitLabel}</Text>
      </Pressable>
    </ScrollView>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { padding: space.md, gap: space.sm, backgroundColor: theme.colors.background },
    label: {
      fontFamily: theme.font.bodySemiBold,
      fontSize: 13,
      color: theme.colors.inkMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: space.sm,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.hairlineStrong,
      borderRadius: radius.input,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontFamily: theme.font.body,
      fontSize: 16,
      color: theme.colors.ink,
    },
    notes: { minHeight: 80, textAlignVertical: 'top', fontStyle: 'italic' },
    link: {
      fontFamily: theme.font.bodySemiBold,
      fontSize: 14,
      color: theme.colors.accent,
      textDecorationLine: 'underline',
      marginVertical: space.sm,
    },
    linkDisabled: { opacity: 0.5 },
    submitButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: radius.input,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: space.sm,
    },
    submitButtonLabel: { fontFamily: theme.font.bodySemiBold, fontSize: 16, color: theme.colors.accentOn },
    error: { fontFamily: theme.font.body, color: theme.colors.error },
  });
}
