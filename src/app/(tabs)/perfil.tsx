import { router } from 'expo-router';
import { useEffect } from 'react';
import { Button, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';
import { useBoardsStore } from '../../stores/boardsStore';

export default function ProfileScreen() {
  const boards = useBoardsStore((s) => s.boards);
  const error = useBoardsStore((s) => s.error);
  const load = useBoardsStore((s) => s.load);

  // Mutations reload the list inside the store, so one load on mount suffices.
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.container}>
      <Text style={styles.section}>{t.boards.sectionTitle}</Text>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={boards}
        keyExtractor={(board) => board.id}
        contentContainerStyle={boards.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={<Text style={styles.empty}>{t.boards.empty}</Text>}
        renderItem={({ item }) => {
          const details = [
            item.boardType !== null ? t.boards.types[item.boardType] : null,
            item.volumeL !== null ? `${item.volumeL} L` : null,
          ]
            .filter((d) => d !== null)
            .join(' · ');
          return (
            <Pressable style={styles.row} onPress={() => router.push(`/board/${item.id}`)}>
              <Text style={styles.name}>{item.name}</Text>
              {details !== '' && <Text style={styles.details}>{details}</Text>}
            </Pressable>
          );
        }}
      />
      <View style={styles.footer}>
        <Button title={t.boards.create} onPress={() => router.push('/board/nova')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { fontSize: 20, fontWeight: '700', paddingHorizontal: 16, paddingTop: 16 },
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
  details: { fontSize: 13, color: '#666' },
  footer: { padding: 16 },
  error: { color: '#c0392b', padding: 16 },
});
