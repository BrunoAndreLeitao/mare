import { router } from 'expo-router';

import { BoardForm } from '../../components/BoardForm';
import { t } from '../../i18n';
import { useBoardsStore } from '../../stores/boardsStore';

export default function NewBoardScreen() {
  const createBoard = useBoardsStore((s) => s.create);
  const error = useBoardsStore((s) => s.error);

  return (
    <BoardForm
      submitLabel={t.boards.create}
      externalError={error}
      onSubmit={async (values) => {
        const board = await createBoard({
          name: values.name,
          boardType: values.boardType ?? undefined,
          volumeL: values.volumeL ?? undefined,
        });
        if (board !== null) {
          router.back();
        }
      }}
    />
  );
}
