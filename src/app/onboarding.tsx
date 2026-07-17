import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { t } from '../i18n';
import { type Theme, useTheme, radius, space } from '../theme';

// Um ecrã com 3 passos (estado local), não 3 rotas: o back do sistema não
// deve navegar entre passos de boas-vindas.
type Step = 0 | 1 | 2;

// Os mesmos ícones da tab bar — o mockup pedia SVGs próprios, mas isso era
// react-native-svg (dep nova) para 3 ícones numa app que já usa Ionicons.
const HOW_ICONS = ['water', 'location', 'person'] as const;

function Dots({ step }: { step: Step }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.dots}>
      {([0, 1, 2] as const).map((i) => (
        <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
      ))}
    </View>
  );
}

function HowRow({ icon, title, body }: { icon: (typeof HOW_ICONS)[number]; title: string; body: string }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.howRow}>
      <Ionicons name={icon} size={24} color={theme.colors.accent} />
      <View style={styles.howText}>
        <Text style={styles.howRowTitle}>{title}</Text>
        <Text style={styles.howRowBody}>{body}</Text>
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const [step, setStep] = useState<Step>(0);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // Sair sem criar spot: o onboarding volta no próximo arranque enquanto não
  // houver spots (não há flag persistida — o estado do utilizador é o
  // critério). É a intenção: sem spot não há nada a fazer na app.
  function dismiss() {
    router.replace('/(tabs)');
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.body}>
        {step === 0 && (
          <View style={styles.stepBody}>
            <Ionicons name="water" size={64} color={theme.colors.accent} />
            <Text style={styles.brand}>{t.onboarding.brand}</Text>
            <Text style={styles.tagline}>{t.onboarding.tagline}</Text>
            <View style={styles.pitch}>
              <Text style={styles.pitchLine1}>{t.onboarding.pitchLine1}</Text>
              <Text style={styles.pitchLine2}>{t.onboarding.pitchLine2}</Text>
            </View>
          </View>
        )}

        {step === 1 && (
          <View style={styles.stepBody}>
            <Text style={styles.howTitle}>{t.onboarding.howTitle}</Text>
            <View style={styles.howList}>
              <HowRow icon={HOW_ICONS[0]} title={t.onboarding.how1Title} body={t.onboarding.how1Body} />
              <HowRow icon={HOW_ICONS[1]} title={t.onboarding.how2Title} body={t.onboarding.how2Body} />
              <HowRow icon={HOW_ICONS[2]} title={t.onboarding.how3Title} body={t.onboarding.how3Body} />
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepBody}>
            <Text style={styles.readyTitle}>{t.onboarding.readyTitle}</Text>
            <Text style={styles.readyBody}>{t.onboarding.readyBody}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Dots step={step} />
        {step === 0 && (
          <Pressable style={styles.cta} onPress={() => setStep(1)}>
            <Text style={styles.ctaLabel}>{t.onboarding.start}</Text>
          </Pressable>
        )}
        {step === 1 && (
          <>
            <Pressable style={styles.cta} onPress={() => setStep(2)}>
              <Text style={styles.ctaLabel}>{t.onboarding.next}</Text>
            </Pressable>
            <Pressable onPress={dismiss} hitSlop={8}>
              <Text style={styles.link}>{t.onboarding.skip}</Text>
            </Pressable>
          </>
        )}
        {step === 2 && (
          <>
            <Pressable
              style={styles.cta}
              onPress={() => {
                // Duas navegações de propósito: o replace põe as tabs como raiz
                // (o onboarding não é sítio a que se volte), o push empilha o
                // formulário por cima. Sem o replace, o back do formulário — e o
                // router.back() pós-criação — não tinham para onde voltar.
                router.replace('/(tabs)');
                router.push('/spot/novo');
              }}
            >
              <Text style={styles.ctaLabel}>{t.onboarding.createSpot}</Text>
            </Pressable>
            <Pressable onPress={dismiss} hitSlop={8}>
              <Text style={styles.link}>{t.onboarding.later}</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    body: { flexGrow: 1, justifyContent: 'center', padding: space.lg },
    stepBody: { alignItems: 'center', gap: space.sm },
    brand: { fontFamily: theme.font.displayItalic, fontSize: 44, color: theme.colors.ink },
    tagline: { fontFamily: theme.font.body, fontSize: 15, color: theme.colors.inkMuted },
    pitch: { marginTop: space.xl, gap: space.xs },
    pitchLine1: { textAlign: 'center', fontFamily: theme.font.body, fontSize: 17, color: theme.colors.inkMuted },
    pitchLine2: { textAlign: 'center', fontFamily: theme.font.bodySemiBold, fontSize: 17, color: theme.colors.accent },
    howTitle: { fontFamily: theme.font.displaySemiBold, fontSize: 26, color: theme.colors.ink, marginBottom: space.lg },
    howList: { gap: space.lg },
    howRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
    howText: { flex: 1, gap: space.xs2 },
    howRowTitle: { fontFamily: theme.font.bodySemiBold, fontSize: 16, color: theme.colors.ink },
    howRowBody: { fontFamily: theme.font.body, fontSize: 14, color: theme.colors.inkMuted },
    readyTitle: { textAlign: 'center', fontFamily: theme.font.displayItalic, fontSize: 32, color: theme.colors.ink },
    readyBody: { textAlign: 'center', fontFamily: theme.font.body, fontSize: 15, color: theme.colors.inkMuted },
    footer: { padding: space.md, gap: space.md, alignItems: 'center' },
    dots: { flexDirection: 'row', gap: space.sm },
    dot: { width: 7, height: 7, borderRadius: radius.chip, backgroundColor: theme.colors.hairlineStrong },
    dotActive: { backgroundColor: theme.colors.accent },
    cta: {
      alignSelf: 'stretch',
      backgroundColor: theme.colors.accent,
      borderRadius: radius.input,
      paddingVertical: 14,
      alignItems: 'center',
    },
    ctaLabel: { fontFamily: theme.font.bodySemiBold, fontSize: 16, color: theme.colors.accentOn },
    link: { fontFamily: theme.font.bodySemiBold, fontSize: 14, color: theme.colors.inkMuted },
  });
}
