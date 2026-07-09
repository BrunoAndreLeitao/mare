import { router } from 'expo-router';
import { Button, StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';

// Histórico chega na Tarefa 7; por agora, empty state + registo.
export default function SessionsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.body}>
        <Text style={styles.title}>{t.sessions.emptyTitle}</Text>
        <Text style={styles.text}>{t.sessions.emptyBody}</Text>
      </View>
      <View style={styles.footer}>
        <Button title={t.sessions.register} onPress={() => router.push('/sessao/nova')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  title: { fontSize: 18, fontWeight: '600' },
  text: { textAlign: 'center', color: '#666' },
  footer: { padding: 16 },
});
