import { StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';

export default function SessionsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t.sessions.emptyTitle}</Text>
      <Text style={styles.body}>{t.sessions.emptyBody}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  title: { fontSize: 18, fontWeight: '600' },
  body: { textAlign: 'center', color: '#666' },
});
