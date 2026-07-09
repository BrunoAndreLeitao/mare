import { Stack } from 'expo-router';

import { t } from '../i18n';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="spot/novo" options={{ title: t.spots.newTitle }} />
      <Stack.Screen name="spot/[id]" options={{ title: t.spots.editTitle }} />
      <Stack.Screen name="board/nova" options={{ title: t.boards.newTitle }} />
      <Stack.Screen name="board/[id]" options={{ title: t.boards.editTitle }} />
      <Stack.Screen name="sessao/nova" options={{ title: t.sessions.newTitle }} />
    </Stack>
  );
}
