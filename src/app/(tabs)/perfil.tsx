import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';
import { useBoardsStore } from '../../stores/boardsStore';
import { type Theme, useTheme, radius, space } from '../../theme';

export default function ProfileScreen() {
  const boards = useBoardsStore((s) => s.boards);
  const error = useBoardsStore((s) => s.error);
  const load = useBoardsStore((s) => s.load);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

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

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    section: {
      fontFamily: theme.font.displaySemiBold,
      fontSize: 22,
      color: theme.colors.ink,
      paddingHorizontal: space.md,
      paddingTop: space.md,
    },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
    empty: { textAlign: 'center', fontFamily: theme.font.body, color: theme.colors.inkMuted },
    row: {
      paddingHorizontal: space.md,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.hairline,
      gap: 2,
    },
    name: { fontFamily: theme.font.displaySemiBold, fontSize: 16, color: theme.colors.ink },
    details: { fontFamily: theme.font.mono, fontSize: 13, color: theme.colors.inkMuted },
    footer: { padding: space.md },
    addButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: radius.input,
      paddingVertical: 14,
      alignItems: 'center',
    },
    addButtonLabel: { fontFamily: theme.font.bodySemiBold, fontSize: 16, color: theme.colors.accentOn },
    error: { fontFamily: theme.font.body, color: theme.colors.error, padding: space.md },
  });
}
