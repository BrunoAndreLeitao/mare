import { Fraunces_500Medium, Fraunces_500Medium_Italic, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { InstrumentSans_400Regular, InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium, JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono';
import { Spectral_500Medium, Spectral_500Medium_Italic, Spectral_600SemiBold } from '@expo-google-fonts/spectral';
import { Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold, Archivo_700Bold } from '@expo-google-fonts/archivo';
import NetInfo from '@react-native-community/netinfo';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { View } from 'react-native';

import { t } from '../i18n';
import { runPendingQueue } from '../services/openmeteo/runner';
import { useTheme } from '../theme';

export default function RootLayout() {
  // As 5 famílias carregam sempre, independentemente do tema ativo: carregar
  // só as do tema pouparia arranque mas daria flash de fonte ao trocar o tema
  // com a app aberta.
  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_500Medium,
    Fraunces_500Medium_Italic,
    InstrumentSans_400Regular,
    InstrumentSans_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
    Spectral_500Medium,
    Spectral_500Medium_Italic,
    Spectral_600SemiBold,
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
  });
  const theme = useTheme();

  useEffect(() => {
    // Trigger 1: arranque da app (docs/OPEN_METEO.md §6).
    runPendingQueue().catch((e) => console.warn('[worker] trigger arranque:', e));

    // Trigger 2: transição offline→online — SÓ a transição (o netinfo emite em
    // cada mudança; wasConnected===false filtra o evento inicial e duplicados).
    let wasConnected: boolean | null = null;
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = state.isConnected ?? false;
      if (connected && wasConnected === false) {
        runPendingQueue().catch((e) => console.warn('[worker] trigger netinfo:', e));
      }
      wasConnected = connected;
    });
    return unsubscribe;
  }, []);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }

  const screenOptions = {
    headerStyle: { backgroundColor: theme.colors.background },
    headerTintColor: theme.colors.ink,
    headerTitleStyle: { fontFamily: theme.font.bodySemiBold },
    contentStyle: { backgroundColor: theme.colors.background },
  };

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="spot/novo" options={{ title: t.spots.newTitle }} />
      <Stack.Screen name="spot/[id]" options={{ title: t.spots.editTitle }} />
      <Stack.Screen name="board/nova" options={{ title: t.boards.newTitle }} />
      <Stack.Screen name="board/[id]" options={{ title: t.boards.editTitle }} />
      <Stack.Screen name="sessao/nova" options={{ title: t.sessions.newTitle }} />
      <Stack.Screen name="sessao/[id]" options={{ title: t.sessions.detailTitle }} />
      <Stack.Screen name="sessao/editar/[id]" options={{ title: t.sessions.editTitle }} />
    </Stack>
  );
}
