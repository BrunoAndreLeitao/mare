import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';
import { useSpotsStore } from '../../stores/spotsStore';
import { type Theme, useTheme, radius, space } from '../../theme';

export default function SpotsScreen() {
  const spots = useSpotsStore((s) => s.spots);
  const error = useSpotsStore((s) => s.error);
  const load = useSpotsStore((s) => s.load);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

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

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
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
    coords: { fontFamily: theme.font.mono, fontSize: 13, color: theme.colors.inkMuted },
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
