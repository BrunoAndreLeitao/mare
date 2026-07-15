import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { BoardForm } from '../../components/BoardForm';
import { t } from '../../i18n';
import { colors, font, space } from '../../theme';
import { useBoardsStore } from '../../stores/boardsStore';

export default function EditBoardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const board = useBoardsStore((s) => s.boards.find((x) => x.id === id));
  const updateBoard = useBoardsStore((s) => s.update);
  const archiveBoard = useBoardsStore((s) => s.archive);
  const error = useBoardsStore((s) => s.error);

  // Only reachable from the quiver list, which loads the store on mount.
  if (board === undefined) {
    return null;
  }

  function confirmArchive(boardId: string) {
    Alert.alert(t.common.archive, t.boards.archiveConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.archive,
        style: 'destructive',
        onPress: async () => {
          if (await archiveBoard(boardId)) {
            router.back();
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <BoardForm
        initial={{
          name: board.name,
          boardType: board.boardType,
          volumeL: board.volumeL,
        }}
        submitLabel={t.common.save}
        externalError={error}
        onSubmit={async (values) => {
          const updated = await updateBoard(board.id, values);
          if (updated !== null) {
            router.back();
          }
        }}
      />
      <View style={styles.archive}>
        <Pressable onPress={() => confirmArchive(board.id)} hitSlop={8}>
          <Text style={styles.archiveLabel}>{t.common.archive}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  archive: { padding: space.md, alignItems: 'center' },
  archiveLabel: {
    fontFamily: font.bodySemiBold,
    fontSize: 14,
    color: colors.error,
    textDecorationLine: 'underline',
  },
});
