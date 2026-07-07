import * as Location from 'expo-location';
import { useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { t } from '../i18n';
import { parseDecimal, validateCoords } from '../utils/coords';

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

      <View style={styles.locationButton}>
        <Button title={t.spots.useMyLocation} onPress={fillFromLocation} disabled={locating} />
      </View>

      <Text style={styles.label}>{t.spots.notes}</Text>
      <TextInput
        style={[styles.input, styles.notes]}
        value={notes}
        onChangeText={setNotes}
        placeholder={t.spots.notesPlaceholder}
        multiline
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
  notes: { minHeight: 80, textAlignVertical: 'top' },
  locationButton: { marginVertical: 8 },
  error: { color: '#c0392b' },
});
