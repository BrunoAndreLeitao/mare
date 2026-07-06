import { StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';

// Quiver entra aqui na Tarefa 5.
export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.body}>{t.profile.placeholder}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  body: { textAlign: 'center', color: '#666' },
});
