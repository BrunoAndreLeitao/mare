import { Stack } from 'expo-router';

import { t } from '../i18n';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="spot/novo" options={{ title: t.spots.newTitle }} />
      <Stack.Screen name="spot/[id]" options={{ title: t.spots.editTitle }} />
    </Stack>
  );
}
