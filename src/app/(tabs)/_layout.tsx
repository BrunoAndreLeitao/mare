import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { t } from '../../i18n';
import { useTheme } from '../../theme';

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.inkMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.hairline,
        },
        tabBarLabelStyle: { fontFamily: theme.font.bodySemiBold, fontSize: 11 },
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.ink,
        headerTitleStyle: { fontFamily: theme.font.bodySemiBold },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.sessions,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'water' : 'water-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="spots"
        options={{
          title: t.tabs.spots,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'location' : 'location-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: t.tabs.profile,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
