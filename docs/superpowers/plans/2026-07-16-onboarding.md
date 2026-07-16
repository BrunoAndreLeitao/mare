# Onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um utilizador que abre a Maré pela primeira vez vê 3 ecrãs de boas-vindas e sai deles a criar o primeiro spot.

**Architecture:** Um ecrã único (`src/app/onboarding.tsx`) com estado local `step: 0|1|2`, não três rotas. Sem flag persistida: o gatilho é o próprio estado (sem spots **e** sem sessões), lido no ecrã de abertura. Textos todos em `t.onboarding`; tema via `useTheme()` + `makeStyles(theme)` como o resto da app.

**Tech Stack:** React Native 0.86 + Expo SDK 57 (expo-router, Zustand), TypeScript strict, `@expo/vector-icons` (já instalado). **Zero deps novas, zero migrations.**

**Spec:** `docs/superpowers/specs/2026-07-16-onboarding-design.md`

## Global Constraints

- Strings de UI em pt-PT via `src/i18n` — nunca hardcoded nos componentes (CLAUDE.md).
- Identificadores em inglês; comentários de código em pt-PT (padrão do projeto).
- Zero cores/fontes hardcoded — tudo de `Theme` via `useTheme()`; `space`/`radius` importados como constantes.
- **Zero dependências novas. Zero migrations.** Se a implementação parecer precisar de uma, é sinal de que algo está errado — PARAR e reportar.
- UI sem testes (MVP, CLAUDE.md regra 4). Esta entrega não acrescenta testes; a suite fica em 100.
- **Gate de tipos: `npx tsc --noEmit`.** O Jest é jest-expo → babel-jest e NÃO type-checka.
- Verificação por tarefa: `npx tsc --noEmit` limpo e `npm test` verde (100).
- Commits: conventional commits com trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Estrutura de ficheiros

| Ficheiro | Responsabilidade | Tarefa |
|---|---|---|
| `src/i18n/index.ts` | Bloco `t.onboarding` com todos os textos | 1 |
| `src/app/onboarding.tsx` | Os 3 passos, dots, CTAs | 1 |
| `src/app/_layout.tsx` | Registo da rota (`headerShown: false`) | 1 |
| `src/app/(tabs)/index.tsx` | Gatilho: redireciona se for utilizador novo | 2 |

---

### Task 1: Ecrã de onboarding + i18n + rota

**Files:**
- Modify: `src/i18n/index.ts`
- Create: `src/app/onboarding.tsx`
- Modify: `src/app/_layout.tsx`

**Interfaces:**
- Consumes: `useTheme(): Theme`, `space`, `radius` de `src/theme.ts`; `t` de `src/i18n`.
- Produces: a rota `/onboarding` (a Task 2 navega para ela).

No fim desta tarefa o ecrã existe e é alcançável por URL, mas nada o mostra automaticamente — é a Task 2 que liga o gatilho. Isso é deliberado: o ecrã é revisível sozinho.

- [ ] **Step 1: Acrescentar os textos ao i18n**

Em `src/i18n/index.ts`, acrescentar um bloco `onboarding` dentro do objeto `t` (a seguir ao bloco `tabs`, antes de `common`):

```ts
  onboarding: {
    // Passo 1 — a tese do produto (frase de posicionamento do CLAUDE.md).
    brand: 'Maré',
    tagline: 'O teu diário de surf',
    pitchLine1: 'O Surfline diz como vai estar o mar.',
    pitchLine2: 'A Maré diz como tu surfas nesse mar.',
    start: 'Começar',
    // Passo 2 — como funciona, 3 factos verdadeiros HOJE (nada de streaks
    // nem recordes: são Fase 4 e ainda não existem).
    howTitle: 'Como funciona',
    how1Title: 'Regista em 10 segundos',
    how1Body: 'Spot, hora, rating, prancha. Saído da água, sem fricção.',
    how2Title: 'As condições chegam sozinhas',
    how2Body: 'Swell, vento e maré, associados à tua sessão automaticamente.',
    how3Title: 'Vê o padrão ao longo do tempo',
    how3Body: 'Cada sessão fica registada com as condições que a fizeram.',
    next: 'Seguinte',
    skip: 'Saltar',
    // Passo 3 — CTA para o primeiro spot (sem spot não há registo possível).
    readyTitle: 'Pronto para a primeira entrada?',
    readyBody: 'Cria o teu primeiro spot para começares a registar.',
    createSpot: 'Criar spot',
    later: 'Talvez mais tarde',
  },
```

- [ ] **Step 2: Criar o ecrã**

Criar `src/app/onboarding.tsx`:

```tsx
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
            <Pressable style={styles.cta} onPress={() => router.replace('/spot/novo')}>
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
```

- [ ] **Step 3: Registar a rota**

Em `src/app/_layout.tsx`, dentro do `<Stack>`, a seguir à linha do `(tabs)`:

```tsx
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
```

(Sem header: é um ecrã de boas-vindas, não tem chrome nem back.)

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit`
Expected: zero erros.

Run: `npm test`
Expected: 100/100 verdes (nenhum teste toca em UI).

- [ ] **Step 5: Commit**

```bash
git add src/i18n/index.ts src/app/onboarding.tsx src/app/_layout.tsx
git commit -m "feat: ecra de onboarding com 3 passos

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Gatilho — mostrar o onboarding a quem é novo

**Files:**
- Modify: `src/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: a rota `/onboarding` (Task 1); `useSpotsStore` (`spots`, `load`, `loading`), `useSessionsStore` (`sessions`, `load`, `loading`).
- Produces: nada.

O `SessionsScreen` hoje só conhece a `sessionsStore`. O critério da spec é "sem spots **E** sem sessões", por isso o ecrã passa a ler também a `spotsStore`.

**A armadilha desta tarefa:** ambas as stores começam com arrays vazios antes de carregarem. Redirecionar sem esperar pelo carregamento mostraria o onboarding a toda a gente, um flash, em cada arranque. O gatilho só dispara com as duas stores carregadas — daí o `loading` das duas entrar na condição.

- [ ] **Step 1: Confirmar a forma das stores**

Run: `grep -n "loading\|spots:\|load(" src/stores/spotsStore.ts | head -10`
Expected: confirma que `spotsStore` tem `spots: Spot[]`, `loading: boolean` (inicial `false`) e `load()`. Se algum não existir com esse nome, **PARAR e reportar** — não inventar um nome nem acrescentar o campo.

**Facto confirmado que molda o Step 2:** `loading` nasce `false`, não `true`. Logo `!loading && spots.length === 0` é verdade no primeiro render, ANTES do load correr — usar só essa condição daria o flash de onboarding que esta tarefa existe para evitar. Daí o `loaded` local do Step 2: só depois de o load ter efetivamente terminado é que o gatilho pode julgar.

- [ ] **Step 2: Ligar o gatilho**

Em `src/app/(tabs)/index.tsx`:

1. Acrescentar `useEffect` ao import de `react`:
```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
```
2. Acrescentar o import da spotsStore, a seguir ao da sessionsStore:
```tsx
import { useSpotsStore } from '../../stores/spotsStore';
```
3. Dentro de `SessionsScreen`, a seguir aos hooks existentes da store:
```tsx
  const spots = useSpotsStore((s) => s.spots);
  const loadSpots = useSpotsStore((s) => s.load);
  // O gatilho do onboarding só pode julgar DEPOIS de as duas listas terem
  // carregado: ambas nascem vazias e `loading` nasce false, por isso a
  // condição "vazio" é verdade no primeiro render de qualquer utilizador.
  const [loaded, setLoaded] = useState(false);
```
4. A seguir ao `onRefresh`, acrescentar o carregamento dos spots e o gatilho:
```tsx
  // Os spots só interessam aqui para o gatilho do onboarding (a lista em si
  // não os usa) — daí carregarem uma vez, sem focus effect. O load das
  // sessões vive no useFocusEffect abaixo; esperamos pelos dois.
  useEffect(() => {
    void Promise.all([loadSpots(), load()]).then(() => setLoaded(true));
  }, [loadSpots, load]);

  // Utilizador novo = sem spots E sem sessões. A conjunção importa: quem
  // arquive todos os spots mas tenha histórico não é novo.
  useEffect(() => {
    if (loaded && spots.length === 0 && sessions.length === 0) {
      router.replace('/onboarding');
    }
  }, [loaded, spots.length, sessions.length]);
```

Nota: o `load()` das sessões corre duas vezes no arranque (aqui e no `useFocusEffect` existente) — é uma query local a SQLite, e a alternativa (mexer no `useFocusEffect`, que serve a reatividade do worker) arriscava partir a Fase 2 por uma micro-otimização. Deixar como está.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: zero erros.

Run: `npm test`
Expected: 100/100 verdes.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(tabs)/index.tsx"
git commit -m "feat: mostrar onboarding a quem nao tem spots nem sessoes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Fecho — BACKLOG e DESIGN.md

**Files:**
- Modify: `BACKLOG.md`
- Modify: `DESIGN.md`

**Interfaces:**
- Consumes: nada. Documenta o que as Tasks 1-2 fizeram.
- Produces: nada.

- [ ] **Step 1: Marcar o P1 do onboarding no BACKLOG**

Em `BACKLOG.md`, na Fase 3, a linha do onboarding está hoje marcada como ADIADO. Substituir por:

```markdown
- [x] P1 — Onboarding mínimo: 2 ecrãs (o que é a Maré, criar primeiro spot) — FEITO com 3 ecrãs (secção 7 do mockup): tese do produto, como funciona, CTA para o primeiro spot. Gatilho sem flag persistida: sem spots E sem sessões = utilizador novo.
```

- [ ] **Step 2: Registar o conflito da hora no DESIGN.md**

O mockup (secção 9) diz que a hora, na edição de sessão, deve ser só leitura; a app faz o contrário e foi validado no dispositivo. Acrescentar à tabela "Decisões e porquê" do `DESIGN.md`:

| Decisão | Racional |
|---|---|
| Editar sessão: a hora é editável, contra a secção 9 do mockup ("só leitura, a hora já tem condições associadas") | Corrigir uma hora mal registada é um caso real; a invalidação de condições já existe no repo, testada, e o refetch é automático. Validado no dispositivo em 2026-07-16. |

E, a seguir à tabela, a nota das divergências do onboarding:

```markdown
**Onboarding (secção 7 do mockup) — divergências deliberadas:** a 3ª linha do
passo 2 não promete "recordes e streaks" (não existem: são Fase 4); o CTA final
leva a criar spot em vez de registar sessão (sem spot, registar é uma parede);
os ícones são os Ionicons da tab bar, não os SVG paths do mockup (evita
react-native-svg para 3 ícones).
```

- [ ] **Step 3: Commit**

```bash
git add BACKLOG.md DESIGN.md
git commit -m "docs: fechar onboarding no BACKLOG e registar divergencias do mockup

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## DoD no dispositivo (o utilizador valida no fim)

1. Com a app sem spots (arquivar/apagar os que existirem, ou instalação limpa) → arranca no onboarding, sem flash da lista de sessões antes.
2. Os 3 passos navegam com os CTAs; "Criar spot" abre o formulário de spot.
3. Criar o spot → a app deixa de mostrar o onboarding nos arranques seguintes.
4. "Saltar" e "Talvez mais tarde" levam à app; ao reabrir, o onboarding volta (enquanto não houver spot) — comportamento pretendido.
5. Os 3 passos legíveis nos dois temas (claro e escuro).

## Notas de comportamento assumidas (não são gaps)

- **Sem swipe entre passos:** os CTAs bastam; um `PagerView` seria dep nova.
- **O onboarding reaparece a quem salta:** não há flag; o critério é o estado. Intencional (ver spec).
- **`router.replace('/spot/novo')` no CTA final:** o utilizador cai no formulário de spot com o back a levar às tabs, não ao onboarding — correto (o onboarding não é sítio a que se volte).
- **Um utilizador que apague todos os spots e sessões revê o onboarding.** Aceite na spec.
