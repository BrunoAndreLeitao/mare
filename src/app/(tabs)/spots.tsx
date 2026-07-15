import { router } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';
import { useSpotsStore } from '../../stores/spotsStore';
import { colors, font, radius, space } from '../../theme';

export default function SpotsScreen() {
  const spots = useSpotsStore((s) => s.spots);
  const error = useSpotsStore((s) => s.error);
  const load = useSpotsStore((s) => s.load);

  // Mutations reload the list inside the store, so one load on mount suffices.
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.container}>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={spots}
        keyExtractor={(spot) => spot.id}
        contentContainerStyle={spots.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={<Text style={styles.empty}>{t.spots.empty}</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/spot/${item.id}`)}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.coords}>
              {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
            </Text>
          </Pressable>
        )}
      />
      <View style={styles.footer}>
        <Pressable style={styles.addButton} onPress={() => router.push('/spot/novo')}>
          <Text style={styles.addButtonLabel}>{t.spots.create}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  empty: { textAlign: 'center', fontFamily: font.body, color: colors.inkMuted },
  row: {
    paddingHorizontal: space.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    gap: 2,
  },
  name: { fontFamily: font.displaySemiBold, fontSize: 16, color: colors.ink },
  coords: { fontFamily: font.mono, fontSize: 13, color: colors.inkMuted },
  footer: { padding: space.md },
  addButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.input,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addButtonLabel: { fontFamily: font.bodySemiBold, fontSize: 16, color: colors.accentOn },
  error: { fontFamily: font.body, color: colors.error, padding: space.md },
});
