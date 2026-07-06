import { router } from 'expo-router';
import { useEffect } from 'react';
import { Button, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';
import { useSpotsStore } from '../../stores/spotsStore';

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
        <Button title={t.spots.create} onPress={() => router.push('/spot/novo')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: { textAlign: 'center', color: '#666' },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
    gap: 2,
  },
  name: { fontSize: 16, fontWeight: '600' },
  coords: { fontSize: 13, color: '#666' },
  footer: { padding: 16 },
  error: { color: '#c0392b', padding: 16 },
});
