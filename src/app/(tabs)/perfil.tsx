import { router } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';
import { useBoardsStore } from '../../stores/boardsStore';
import { colors, font, radius, space } from '../../theme';

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
        <Pressable style={styles.addButton} onPress={() => router.push('/board/nova')}>
          <Text style={styles.addButtonLabel}>{t.boards.create}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  section: {
    fontFamily: font.displaySemiBold,
    fontSize: 22,
    color: colors.ink,
    paddingHorizontal: space.md,
    paddingTop: space.md,
  },
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
  details: { fontFamily: font.mono, fontSize: 13, color: colors.inkMuted },
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
