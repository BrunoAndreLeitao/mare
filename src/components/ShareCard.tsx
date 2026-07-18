import { Ionicons } from '@expo/vector-icons';
import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { type ShareCardModel } from '../services/share/shareCardModel';
import { fmtLocal } from '../utils/format';
import { type Theme, useTheme, radius, space } from '../theme';

// "Print emoldurado" do mockup (t14): leitura hero limpa + marca Maré. Sem
// lógica de decisão — recebe o modelo pronto (buildShareCardModel) e desenha.
// O ref é o alvo do captureRef (shareSession); daí o forwardRef.
export const ShareCard = forwardRef<View, { model: ShareCardModel }>(({ model }, ref) => {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.spot}>{model.spotName}</Text>
        <Text style={styles.when}>{fmtLocal(new Date(model.startedAt * 1000))}</Text>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.stars}>
          {([1, 2, 3, 4, 5] as const).map((v) => (
            <Ionicons
              key={v}
              name={v <= model.rating ? 'star' : 'star-outline'}
              size={18}
              color={v <= model.rating ? theme.colors.accent : theme.colors.starEmpty}
            />
          ))}
        </View>
        {model.meta.length > 0 && <Text style={styles.meta}>{model.meta.join(' · ')}</Text>}
      </View>

      {model.hero !== null && (
        <View style={styles.hero}>
          <Text style={styles.heroSwell}>{model.hero.swell}</Text>
          <Text style={styles.heroPeriod}>{model.hero.period}</Text>
        </View>
      )}
      {model.context !== null && <Text style={styles.context}>{model.context}</Text>}

      <Text style={styles.brand}>Maré</Text>
    </View>
  );
});
ShareCard.displayName = 'ShareCard';

// Sem useMemo: o ShareCard monta-se uma vez para a captura, não numa lista.
function makeStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      width: 340,
      padding: space.lg,
      backgroundColor: theme.colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      gap: space.sm,
    },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    spot: { fontFamily: theme.font.displaySemiBold, fontSize: 24, color: theme.colors.ink },
    when: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.inkMuted },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    stars: { flexDirection: 'row', gap: 2 },
    meta: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.inkMuted },
    hero: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginTop: space.sm },
    heroSwell: { fontFamily: theme.font.monoMedium, fontSize: 40, color: theme.colors.ink },
    heroPeriod: { fontFamily: theme.font.mono, fontSize: 22, color: theme.colors.inkMuted },
    context: { fontFamily: theme.font.mono, fontSize: 14, color: theme.colors.inkMuted },
    brand: {
      fontFamily: theme.font.displayItalic,
      fontSize: 15,
      color: theme.colors.accent,
      marginTop: space.md,
    },
  });
}
