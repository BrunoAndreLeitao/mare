# Dark mode "Carta Náutica" + ícones de direção/maré — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A app segue o tema do sistema — claro "Caderno de bordo" (atual) ou escuro "Carta Náutica" (novo, com tipografia e acento próprios) — e mostra direção de vento/swell e fase de maré com setas em vez de só números.

**Architecture:** `src/theme.ts` passa de constantes exportadas a dois objetos `Theme` com a mesma forma (`lightTheme`/`darkTheme`) mais um hook `useTheme()` que escolhe via `useColorScheme()`. Cada ficheiro de UI troca o import estático por `const theme = useTheme()` + `useMemo(() => makeStyles(theme), [theme])`, com `makeStyles(theme: Theme)` definido fora do componente. Os ícones são `Ionicons` rodados por uma função pura testada.

**Tech Stack:** React Native 0.86 + Expo SDK 57 (expo-router, Zustand), TypeScript strict, `@expo-google-fonts/*` via `expo install`, `@expo/vector-icons` (já instalado). Jest + better-sqlite3 para testes de lógica.

**Spec:** `docs/superpowers/specs/2026-07-16-dark-mode-icones-direcao-design.md`

## Global Constraints

- Strings de UI em pt-PT via `src/i18n` — nunca hardcoded nos componentes (CLAUDE.md).
- Identificadores em inglês; comentários de código em pt-PT (padrão do projeto).
- **Zero cores ou fontes hardcoded nos ecrãs** — tudo vem do `Theme`. `space` e `radius` continuam constantes importadas (não variam com o tema).
- Dependências novas só via `expo install` (nunca editar package.json à mão), com justificação escrita no commit: `@expo-google-fonts/spectral`, `@expo-google-fonts/archivo`. **Nenhuma outra** — em particular, `react-native-svg` NÃO entra.
- **Gate de tipos: `npx tsc --noEmit`.** O Jest deste projeto é jest-expo → babel-jest e **NÃO** type-checka; `npm test` nunca falha por erro de tipos.
- UI sem testes (MVP, CLAUDE.md regra 4). Único teste novo: `bearingToArrowRotation`.
- Verificação por tarefa: `npx tsc --noEmit` limpo e `npm test` verde (96 testes até à Tarefa 5; 97+ depois).
- Commits: conventional commits, com trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- **Decisão encerrada (não reabrir):** o tema escuro usa Spectral/Archivo e acento azul `#4C7C9C` porque foi escolha explícita do utilizador, com o custo (troca de identidade entre temas) apresentado e aceite.

## Estrutura de ficheiros

| Ficheiro | Responsabilidade | Tarefa |
|---|---|---|
| `src/theme.ts` | `Theme`, `lightTheme`, `darkTheme`, `useTheme`, `space`, `radius` | 1 |
| `src/app/_layout.tsx` | Carrega 5 famílias de fontes; Stack por tema | 1 |
| `src/app/(tabs)/_layout.tsx` | Tab bar por tema | 2 |
| `src/app/(tabs)/index.tsx` | Lista de sessões + cartão por tema | 2 |
| `src/components/SessionForm.tsx` | Formulário partilhado por tema | 3 |
| `src/app/sessao/[id].tsx` | Detalhe por tema | 3 |
| `src/app/sessao/nova.tsx` | Empty state "sem spots" por tema | 3 |
| `src/app/(tabs)/spots.tsx`, `(tabs)/perfil.tsx` | Listas por tema | 4 |
| `src/components/SpotForm.tsx`, `BoardForm.tsx` | Formulários por tema | 4 |
| `src/app/spot/[id].tsx`, `board/[id].tsx` | Botão arquivar por tema | 4 |
| `src/utils/directions.ts` | `degToCardinal` (existe) + `bearingToArrowRotation` (novo) | 5 |
| `src/components/DirectionArrow.tsx` | Seta rodada + ícone de maré | 5 |

`src/app/spot/novo.tsx` e `board/nova.tsx` são wrappers sem estilo próprio — não são tocados.

---

### Task 1: Infra — fontes, dois temas, useTheme

**Files:**
- Modify: `src/theme.ts` (reescrita completa)
- Modify: `src/app/_layout.tsx`
- Modify: `package.json` (via `expo install`, não à mão)

**Interfaces:**
- Consumes: nada (primeira tarefa).
- Produces (todas as tarefas seguintes dependem disto, verbatim):
```ts
export interface Theme {
  colors: {
    background: string; surface: string; ink: string; inkMuted: string;
    accent: string; accentOn: string; accentSoft: string; success: string;
    error: string; pending: string; hairline: string; hairlineStrong: string;
    starEmpty: string;
  };
  font: {
    display: string; displayItalic: string; displaySemiBold: string;
    body: string; bodySemiBold: string;
    mono: string; monoMedium: string; monoSemiBold: string;
  };
}
export const lightTheme: Theme;
export const darkTheme: Theme;
export function useTheme(): Theme;
export const space: { xs2: 2; xs: 4; sm: 8; md: 16; lg: 24; xl: 32; xl2: 48 };
export const radius: { chip: 999; card: 12; input: 8 };
```

Nota para o implementador: `colors` e `font` deixam de ser exportados. Isto **parte de propósito** todos os ecrãs — as Tarefas 2-4 arrumam-nos um bloco de cada vez. No fim desta tarefa `npx tsc --noEmit` terá erros nos ecrãs ainda não migrados; isso é esperado e está previsto no Step 5. O `_layout.tsx` é migrado aqui porque é ele que carrega as fontes.

- [ ] **Step 1: Instalar as fontes novas**

```bash
npx expo install @expo-google-fonts/spectral @expo-google-fonts/archivo
```

Expected: instala e regista as duas deps em `package.json` (versões ~0.4.x).

- [ ] **Step 2: Reescrever src/theme.ts**

Substituir o conteúdo completo por:

```ts
import { useColorScheme } from 'react-native';

// Dois temas do DESIGN.md + README: claro "Caderno de bordo" (papel quente,
// tinta azul-marinho, acento laranja) e escuro "Carta Náutica" (fundo de
// carta, acento azul). DECISÃO EXPLÍCITA DO UTILIZADOR: os temas têm
// tipografias DIFERENTES (Fraunces/Instrument/JetBrains vs Spectral/Archivo)
// — foi escolha dele no mockup, com o custo da troca de identidade aceite.
// Por isso os tokens de fonte são PAPÉIS (display/body/mono), não famílias.
export interface Theme {
  colors: {
    background: string;
    surface: string;
    ink: string;
    inkMuted: string;
    accent: string;
    accentOn: string; // texto sobre fundo accent (chip selecionado, badge)
    accentSoft: string; // fundos suaves (barras, pills)
    success: string;
    error: string;
    pending: string;
    hairline: string;
    hairlineStrong: string; // contornos de chips/inputs (mais forte que dividers)
    starEmpty: string;
  };
  font: {
    display: string;
    displayItalic: string;
    displaySemiBold: string;
    body: string;
    bodySemiBold: string;
    mono: string;
    monoMedium: string;
    monoSemiBold: string;
  };
}

export const lightTheme: Theme = {
  colors: {
    background: '#F7F2E7',
    surface: '#FBF8F0',
    ink: '#16324F',
    inkMuted: '#5C6B73',
    accent: '#C4622D',
    accentOn: '#F7F2E7',
    accentSoft: '#EAE1CC',
    success: '#3D6B4F',
    error: '#A33B2E',
    pending: '#8A7A5C',
    hairline: '#DCD3BF',
    hairlineStrong: '#C9BE9F',
    starEmpty: '#D9CFB8',
  },
  font: {
    display: 'Fraunces_500Medium',
    displayItalic: 'Fraunces_500Medium_Italic',
    displaySemiBold: 'Fraunces_600SemiBold',
    body: 'InstrumentSans_400Regular',
    bodySemiBold: 'InstrumentSans_600SemiBold',
    mono: 'JetBrainsMono_400Regular',
    monoMedium: 'JetBrainsMono_500Medium',
    monoSemiBold: 'JetBrainsMono_600SemiBold',
  },
};

// Carta Náutica. O escuro não tem monoespaçada própria no README: os papéis
// mono são servidos por Archivo, aceitando a perda de tabular-nums nos
// números do mar (custo assumido da decisão de tipografia por tema).
export const darkTheme: Theme = {
  colors: {
    background: '#14181B',
    surface: '#1C2227',
    ink: '#EDE6D6',
    inkMuted: '#7C8790',
    accent: '#4C7C9C',
    accentOn: '#14181B',
    accentSoft: '#26333C',
    success: '#4C7C9C',
    error: '#C97B4A',
    pending: '#7C8790',
    hairline: '#2C343A',
    hairlineStrong: '#3A424A',
    starEmpty: '#3A424A',
  },
  font: {
    display: 'Spectral_500Medium',
    displayItalic: 'Spectral_500Medium_Italic',
    displaySemiBold: 'Spectral_600SemiBold',
    body: 'Archivo_400Regular',
    bodySemiBold: 'Archivo_600SemiBold',
    mono: 'Archivo_500Medium',
    monoMedium: 'Archivo_600SemiBold',
    monoSemiBold: 'Archivo_700Bold',
  },
};

// Sem preferência persistida (decisão do plano): o telemóvel já sabe se é de
// noite. Se um dia houver override no Perfil, muda-se aqui — os ecrãs não.
export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}

export const space = { xs2: 2, xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xl2: 48 } as const;

export const radius = { chip: 999, card: 12, input: 8 } as const;
```

- [ ] **Step 3: Migrar src/app/_layout.tsx**

Substituir o conteúdo completo por:

```tsx
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
```

- [ ] **Step 4: Confirmar que os nomes dos exports das fontes existem**

Run: `node -e "const s=require('@expo-google-fonts/spectral'); const a=require('@expo-google-fonts/archivo'); console.log(['Spectral_500Medium','Spectral_500Medium_Italic','Spectral_600SemiBold'].map(k=>k+'='+(k in s)).join(' ')); console.log(['Archivo_400Regular','Archivo_500Medium','Archivo_600SemiBold','Archivo_700Bold'].map(k=>k+'='+(k in a)).join(' '))"`

Expected: todos `=true`. Se algum for `false`, o nome do peso difere — **PARAR e reportar**, não inventar um nome alternativo.

- [ ] **Step 5: Verificar o estado esperado (parcialmente partido)**

Run: `npx tsc --noEmit`
Expected: erros APENAS de `colors`/`font` não exportados, nos ficheiros das Tarefas 2-4: `(tabs)/_layout.tsx`, `(tabs)/index.tsx`, `(tabs)/spots.tsx`, `(tabs)/perfil.tsx`, `sessao/nova.tsx`, `sessao/[id].tsx`, `components/SessionForm.tsx`, `components/SpotForm.tsx`, `components/BoardForm.tsx`, `spot/[id].tsx`, `board/[id].tsx`. **Zero erros em `_layout.tsx` ou `theme.ts`** — se houver, é bug desta tarefa.

Run: `npm test`
Expected: 96/96 verdes (nenhum teste toca em tema ou UI).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/theme.ts src/app/_layout.tsx
git commit -m "feat: dois temas (Caderno de bordo/Carta Nautica) com useTheme

Deps novas: @expo-google-fonts/spectral e @expo-google-fonts/archivo — o tema
escuro do README tem tipografia propria (decisao explicita do utilizador).
As 5 familias carregam sempre para evitar flash de fonte ao trocar de tema.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Sessões — lista, cartão e tab bar

**Files:**
- Modify: `src/app/(tabs)/_layout.tsx`
- Modify: `src/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `Theme`, `useTheme`, `space`, `radius` da Task 1.
- Produces: o padrão `makeStyles` que as Tasks 3-4 replicam.

O padrão a seguir em TODOS os ficheiros das Tasks 2-4:

```tsx
import { useMemo } from 'react';
import { type Theme, useTheme, space, radius } from '../../theme';

// dentro do componente:
const theme = useTheme();
const styles = useMemo(() => makeStyles(theme), [theme]);

// fora do componente, no fim do ficheiro:
function makeStyles(theme: Theme) {
  return StyleSheet.create({ /* ... */ });
}
```

Regras: `colors.x` → `theme.colors.x`; `font.x` → `theme.font.x`; `space`/`radius` continuam iguais. Cores usadas em props (não em estilos) passam a `theme.colors.x` diretamente no JSX.

- [ ] **Step 1: Migrar a tab bar**

Substituir o conteúdo de `src/app/(tabs)/_layout.tsx` por:

```tsx
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
```

Nota: as `headerStyle`/`headerTintColor`/`headerTitleStyle` são acrescento desta tarefa — o header das tabs herdava o default branco do RN, que num tema escuro fica gritante. É correção de dívida do mesmo âmbito (tema), não scope creep.

- [ ] **Step 2: Migrar a lista de sessões**

Em `src/app/(tabs)/index.tsx`:

Trocar o import do tema e acrescentar `useMemo`:

```tsx
import { useCallback, useMemo, useState } from 'react';
import { type Theme, useTheme, radius, space } from '../../theme';
```

Os componentes `Stars`, `ConditionsZone` e `SessionCard` estão fora do `SessionsScreen` e usam `styles`. Cada um passa a receber o tema por hook próprio (o `useTheme` é barato — é só `useColorScheme`):

`Stars`:
```tsx
function Stars({ rating }: { rating: number }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.stars}>
      {([1, 2, 3, 4, 5] as const).map((v) => (
        <Ionicons
          key={v}
          name={v <= rating ? 'star' : 'star-outline'}
          size={14}
          color={v <= rating ? theme.colors.accent : theme.colors.starEmpty}
        />
      ))}
    </View>
  );
}
```

`ConditionsZone`: acrescentar no topo da função `const theme = useTheme(); const styles = useMemo(() => makeStyles(theme), [theme]);` — o resto do corpo fica igual.

`SessionCard`: idem — acrescentar as duas linhas no topo; o resto igual.

`SessionsScreen`: acrescentar as duas linhas depois dos hooks da store; o resto igual.

No fim do ficheiro, trocar `const styles = StyleSheet.create({...})` por:

```tsx
function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    emptyContainer: { flex: 1 },
    emptyBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.lg },
    emptyTitle: { fontFamily: theme.font.displayItalic, fontSize: 22, color: theme.colors.ink },
    emptyText: { textAlign: 'center', fontFamily: theme.font.body, fontSize: 15, color: theme.colors.inkMuted },
    emptyCta: { paddingHorizontal: space.xl, marginTop: space.sm },
    card: {
      marginHorizontal: space.md,
      marginTop: space.sm,
      padding: space.md,
      backgroundColor: theme.colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      gap: space.xs,
    },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    spotName: { fontFamily: theme.font.displaySemiBold, fontSize: 17, color: theme.colors.ink },
    when: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.inkMuted },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    stars: { flexDirection: 'row', gap: 1 },
    meta: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.inkMuted },
    condQuiet: { fontFamily: theme.font.body, fontStyle: 'italic', fontSize: 13, color: theme.colors.pending },
    condSignal: { fontFamily: theme.font.monoMedium, fontSize: 17, color: theme.colors.ink },
    condContext: { fontFamily: theme.font.mono, fontSize: 13, color: theme.colors.inkMuted },
    failedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    retry: { fontFamily: theme.font.bodySemiBold, fontSize: 13, color: theme.colors.accent, textDecorationLine: 'underline' },
    footer: { padding: space.md },
    registerButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: radius.input,
      paddingVertical: 14,
      alignItems: 'center',
    },
    registerButtonLabel: { fontFamily: theme.font.bodySemiBold, fontSize: 16, color: theme.colors.accentOn },
    error: { fontFamily: theme.font.body, color: theme.colors.error, padding: space.md },
  });
}
```

Atenção ao `emptyBody`: o ícone `water-outline` no `ListEmptyComponent` usa `color={colors.inkMuted}` — passa a `theme.colors.inkMuted` (o `SessionsScreen` já tem `theme` em scope).

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: os erros de `(tabs)/_layout.tsx` e `(tabs)/index.tsx` desapareceram; continuam os dos ficheiros das Tasks 3-4.

Run: `npm test`
Expected: 96/96 verdes.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(tabs)/_layout.tsx" "src/app/(tabs)/index.tsx"
git commit -m "feat: sessoes e tab bar por tema

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Registo, detalhe e editar sessão

**Files:**
- Modify: `src/components/SessionForm.tsx`
- Modify: `src/app/sessao/[id].tsx`
- Modify: `src/app/sessao/nova.tsx`

**Interfaces:**
- Consumes: `Theme`, `useTheme`, `space`, `radius` (Task 1); padrão `makeStyles` (Task 2).
- Produces: nada — só migração de estilo. Props e comportamento intocados.

`sessao/editar/[id].tsx` não tem estilos próprios (delega no `SessionForm`) — não é tocado.

- [ ] **Step 1: Migrar SessionForm**

Em `src/components/SessionForm.tsx`:

1. Trocar `import { colors, font, radius, space } from '../theme';` por `import { type Theme, useTheme, radius, space } from '../theme';` e acrescentar `useMemo` ao import de `react`.
2. O `Chip` (fora do componente) ganha as duas linhas no topo:
```tsx
function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress(): void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <Pressable style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}
```
3. No `SessionForm`, acrescentar `const theme = useTheme();` e `const styles = useMemo(() => makeStyles(theme), [theme]);` a seguir aos `useState`.
4. As estrelas usam cor em prop: `color={rating !== null && value <= rating ? theme.colors.accent : theme.colors.starEmpty}`.
5. O `placeholderTextColor={colors.inkMuted}` do input de notas passa a `theme.colors.inkMuted`.
6. Trocar `const styles = StyleSheet.create({...})` por:

```tsx
function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { padding: space.md, gap: space.sm, backgroundColor: theme.colors.background },
    label: {
      fontFamily: theme.font.bodySemiBold,
      fontSize: 13,
      color: theme.colors.inkMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: space.sm,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    chip: {
      borderWidth: 1,
      borderColor: theme.colors.hairlineStrong,
      borderRadius: radius.chip,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    chipSelected: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
    chipLabel: { fontFamily: theme.font.body, fontSize: 14, color: theme.colors.ink },
    chipLabelSelected: { fontFamily: theme.font.bodySemiBold, color: theme.colors.accentOn },
    whenPreview: { fontFamily: theme.font.mono, color: theme.colors.inkMuted, fontSize: 13 },
    stars: { flexDirection: 'row', gap: 8 },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.hairlineStrong,
      borderRadius: radius.input,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontFamily: theme.font.body,
      fontSize: 16,
      color: theme.colors.ink,
    },
    notes: { minHeight: 80, textAlignVertical: 'top', fontStyle: 'italic' },
    submitButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: radius.input,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: space.sm,
    },
    submitButtonDisabled: { opacity: 0.5 },
    submitButtonLabel: { fontFamily: theme.font.bodySemiBold, fontSize: 16, color: theme.colors.accentOn },
    error: { fontFamily: theme.font.body, color: theme.colors.error },
  });
}
```

Nota: contornos de chips e inputs passam de `hairline` para `hairlineStrong` — é o token do README para essa função (`#C9BE9F` no claro, `#3A424A` no escuro), e no escuro o `hairline` de divider seria quase invisível num input.

Atenção: se o ficheiro atual tiver `submitButtonDisabled` com outro nome ou estilos adicionais (do fix anti double-submit), **preservar o que lá está** — esta migração é só de tokens, não muda comportamento.

- [ ] **Step 2: Migrar o detalhe de sessão**

Em `src/app/sessao/[id].tsx`:

1. Import: `import { type Theme, useTheme, radius, space } from '../../theme';` e acrescentar `useMemo` ao import de `react`.
2. O `Row` (fora do componente) ganha `const theme = useTheme(); const styles = useMemo(() => makeStyles(theme), [theme]);` no topo.
3. No `SessionDetailScreen`, acrescentar as duas linhas a seguir aos hooks da store.
4. As estrelas e o ícone do lápis usam cor em prop → `theme.colors.accent` / `theme.colors.starEmpty` / `theme.colors.ink`.
5. `const styles = StyleSheet.create({...})` → `function makeStyles(theme: Theme) { return StyleSheet.create({...}); }` com todos os `colors.x`→`theme.colors.x` e `font.x`→`theme.font.x`.

- [ ] **Step 3: Migrar o empty state de nova.tsx**

Em `src/app/sessao/nova.tsx`:

1. Import: `import { type Theme, useTheme, radius, space } from '../../theme';` e acrescentar `useMemo` ao import de `react`.
2. No `NewSessionScreen`, acrescentar `const theme = useTheme();` e `const styles = useMemo(() => makeStyles(theme), [theme]);` a seguir aos hooks das stores.
3. Trocar o `StyleSheet.create` por:

```tsx
function makeStyles(theme: Theme) {
  return StyleSheet.create({
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.lg,
      padding: space.lg,
      backgroundColor: theme.colors.background,
    },
    empty: { textAlign: 'center', fontFamily: theme.font.body, color: theme.colors.inkMuted },
    registerButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: radius.input,
      paddingVertical: 14,
      paddingHorizontal: space.xl,
      alignItems: 'center',
    },
    registerButtonLabel: { fontFamily: theme.font.bodySemiBold, fontSize: 16, color: theme.colors.accentOn },
  });
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit`
Expected: restam só os erros dos ficheiros da Task 4.

Run: `npm test`
Expected: 96/96 verdes.

- [ ] **Step 5: Commit**

```bash
git add src/components/SessionForm.tsx "src/app/sessao/[id].tsx" src/app/sessao/nova.tsx
git commit -m "feat: registo, detalhe e editar sessao por tema

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Spots, Perfil e formulários

**Files:**
- Modify: `src/app/(tabs)/spots.tsx`
- Modify: `src/app/(tabs)/perfil.tsx`
- Modify: `src/components/SpotForm.tsx`
- Modify: `src/components/BoardForm.tsx`
- Modify: `src/app/spot/[id].tsx`
- Modify: `src/app/board/[id].tsx`

**Interfaces:**
- Consumes: `Theme`, `useTheme`, `space`, `radius` (Task 1); padrão `makeStyles` (Task 2).
- Produces: nada. **No fim desta tarefa `npx tsc --noEmit` fica limpo** — nenhum ficheiro importa `colors`/`font`.

Mesmo padrão mecânico das Tasks 2-3 nos seis ficheiros: import de `{ type Theme, useTheme, radius, space }`, `useMemo` no import de `react`, duas linhas no topo de cada componente que usa `styles`, `StyleSheet.create` estático → `makeStyles(theme)`, `colors.x`→`theme.colors.x`, `font.x`→`theme.font.x`.

- [ ] **Step 1: Migrar (tabs)/spots.tsx e (tabs)/perfil.tsx**

Ambos têm um só componente e nenhum uso de cor em props. Aplicar o padrão. Nos dois, `borderBottomColor: colors.hairline` → `theme.colors.hairline`.

- [ ] **Step 2: Migrar SpotForm e BoardForm**

`SpotForm`: um só componente; aplicar o padrão. `placeholderTextColor={colors.inkMuted}` (dois inputs: nome e notas) → `theme.colors.inkMuted`. Contornos de input passam a `theme.colors.hairlineStrong` (mesma razão da Task 3).

`BoardForm`: tem o `Chip` fora do componente — ganha as duas linhas no topo, como na Task 3. `placeholderTextColor` → `theme.colors.inkMuted`. Contornos de chip e input → `theme.colors.hairlineStrong`.

- [ ] **Step 3: Migrar spot/[id].tsx e board/[id].tsx**

Ambos têm só `container` + `archive` + `archiveLabel`. Aplicar o padrão; `archiveLabel` usa `theme.colors.error`.

- [ ] **Step 4: Verificar que a migração está completa**

Run: `npx tsc --noEmit`
Expected: **zero erros**. Se restar algum, é ficheiro por migrar.

Run: `git grep -n "from '\.\./theme'\|from '\.\./\.\./theme'" -- src | grep -v "useTheme"`
Expected: **sem resultados** — nenhum ficheiro importa `colors`/`font` diretamente.

Run: `npm test`
Expected: 96/96 verdes.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(tabs)/spots.tsx" "src/app/(tabs)/perfil.tsx" src/components/SpotForm.tsx src/components/BoardForm.tsx "src/app/spot/[id].tsx" "src/app/board/[id].tsx"
git commit -m "feat: spots, perfil e formularios por tema

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Ícones de direção e maré (TDD)

**Files:**
- Modify: `src/utils/directions.ts`
- Create: `src/utils/__tests__/directions.test.ts` (confirmar primeiro se já existe — se existir, acrescentar o describe novo)
- Create: `src/components/DirectionArrow.tsx`
- Modify: `src/app/(tabs)/index.tsx`
- Modify: `src/app/sessao/[id].tsx`

**Interfaces:**
- Consumes: `Theme`/`useTheme` (Task 1); `degToCardinal(deg: number): string` (já existe).
- Produces:
```ts
// src/utils/directions.ts
export function bearingToArrowRotation(deg: number): number;
// src/components/DirectionArrow.tsx
export function DirectionArrow(props: { deg: number; size?: number; color?: string }): JSX.Element;
export function TideIcon(props: { phase: TidePhase; size?: number; color?: string }): JSX.Element;
```

- [ ] **Step 1: Escrever o teste que falha**

Verificar primeiro se `src/utils/__tests__/directions.test.ts` existe (`ls src/utils/__tests__/`). Se existir, acrescentar só o `describe` novo; se não, criar o ficheiro com:

```ts
import { bearingToArrowRotation, degToCardinal } from '../directions';

describe('bearingToArrowRotation', () => {
  // A Open-Meteo dá direção METEOROLÓGICA — "de onde vem" (322° = vem de NO).
  // Uma seta apontada a 322° apontaria PARA NO, ao contrário do vento real.
  // A rotação da seta é sempre o inverso: +180°.
  test('inverte o rumo para a seta apontar para onde o vento vai', () => {
    expect(bearingToArrowRotation(0)).toBe(180); // vem de N → seta aponta para S
    expect(bearingToArrowRotation(90)).toBe(270); // vem de E → aponta para O
    expect(bearingToArrowRotation(322)).toBe(142); // vem de NO → aponta para SE
  });

  test('normaliza o resultado a [0, 360)', () => {
    expect(bearingToArrowRotation(180)).toBe(0); // 360 → 0, nunca 360
    expect(bearingToArrowRotation(270)).toBe(90);
    expect(bearingToArrowRotation(359)).toBe(179);
  });

  test('aceita rumos fora do intervalo sem partir (defensivo: dados de API)', () => {
    expect(bearingToArrowRotation(-90)).toBe(90);
    expect(bearingToArrowRotation(450)).toBe(270); // 450 ≡ 90 → 270
  });

  // Âncora de coerência: a seta e o cardeal descrevem o mesmo vento.
  test('coerente com degToCardinal no mesmo rumo', () => {
    expect(degToCardinal(322)).toBe('NO');
    expect(bearingToArrowRotation(322)).toBe(142); // SE, o oposto de NO
  });
});
```

- [ ] **Step 2: Correr o teste e vê-lo falhar**

Run: `npm test -- directions`
Expected: FAIL — `TypeError: (0 , _directions.bearingToArrowRotation) is not a function`. (Nota: o babel-jest não type-checka, por isso a falha é em runtime, não de tipos.)

- [ ] **Step 3: Implementar**

Acrescentar a `src/utils/directions.ts`:

```ts
// A Open-Meteo dá direção meteorológica: o rumo DE ONDE o vento/swell vem
// (322° = vem de NO). Uma seta desenhada a apontar 322° apontaria PARA NO —
// ao contrário do movimento real. A seta mostra para onde vai: rumo + 180°.
export function bearingToArrowRotation(deg: number): number {
  return (((deg + 180) % 360) + 360) % 360;
}
```

- [ ] **Step 4: Correr o teste e vê-lo passar**

Run: `npm test -- directions`
Expected: PASS, 4 testes novos.

- [ ] **Step 5: Criar o componente**

`src/components/DirectionArrow.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';

import { type TidePhase } from '../db/types';
import { bearingToArrowRotation } from '../utils/directions';
import { useTheme } from '../theme';

// Seta que aponta para onde o vento/swell VAI (o rumo da API é de onde vem —
// ver bearingToArrowRotation). Acompanha o valor em texto, não o substitui.
export function DirectionArrow({
  deg,
  size = 12,
  color,
}: {
  deg: number;
  size?: number;
  color?: string;
}) {
  const theme = useTheme();
  return (
    <Ionicons
      name="arrow-up"
      size={size}
      color={color ?? theme.colors.inkMuted}
      style={{ transform: [{ rotate: `${bearingToArrowRotation(deg)}deg` }] }}
    />
  );
}

const TIDE_ICONS: Record<TidePhase, 'arrow-up' | 'arrow-down' | 'remove'> = {
  rising: 'arrow-up',
  falling: 'arrow-down',
  high: 'remove', // traço = pico (nem sobe nem desce)
  low: 'remove',
};

export function TideIcon({
  phase,
  size = 12,
  color,
}: {
  phase: TidePhase;
  size?: number;
  color?: string;
}) {
  const theme = useTheme();
  return <Ionicons name={TIDE_ICONS[phase]} size={size} color={color ?? theme.colors.inkMuted} />;
}
```

- [ ] **Step 6: Aplicar no cartão da lista**

Em `src/app/(tabs)/index.tsx`, dentro de `ConditionsZone`, a linha de contexto (vento + maré) é hoje um único `<Text>`. Passa a linha com ícones:

```tsx
      {hasContext && (
        <View style={styles.contextRow}>
          {item.windSpeedKmh !== null ? (
            <View style={styles.contextItem}>
              {item.windDirectionDeg !== null && (
                <DirectionArrow deg={item.windDirectionDeg} color={theme.colors.inkMuted} />
              )}
              <Text style={styles.condContext}>
                {`${item.windSpeedKmh} km/h${item.windDirectionDeg !== null ? ` ${degToCardinal(item.windDirectionDeg)}` : ''}`}
              </Text>
            </View>
          ) : (
            <Text style={styles.condContext}>{DASH}</Text>
          )}
          <Text style={styles.condContext}>{' · '}</Text>
          {item.tidePhase !== null ? (
            <View style={styles.contextItem}>
              <TideIcon phase={item.tidePhase} color={theme.colors.inkMuted} />
              <Text style={styles.condContext}>{t.sessions.tide[item.tidePhase]}</Text>
            </View>
          ) : (
            <Text style={styles.condContext}>{DASH}</Text>
          )}
        </View>
      )}
```

Import novo: `import { DirectionArrow, TideIcon } from '../../components/DirectionArrow';`

Estilos novos em `makeStyles`:
```tsx
    contextRow: { flexDirection: 'row', alignItems: 'center' },
    contextItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
```

- [ ] **Step 7: Aplicar no detalhe**

Em `src/app/sessao/[id].tsx`, o helper `dir` devolve texto. Acrescentar uma `Row` variante que aceita a seta — substituir as duas linhas de direção (`swellDirection` e `windDirection`) e a de maré por versões com ícone:

```tsx
function DirRow({ label, deg }: { label: string; deg: number | null }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.valueWithIcon}>
        {deg !== null && <DirectionArrow deg={deg} size={14} color={theme.colors.ink} />}
        <Text style={styles.rowValue}>{deg !== null ? `${degToCardinal(deg)} (${deg}°)` : DASH}</Text>
      </View>
    </View>
  );
}
```

Usar: `<DirRow label={t.sessions.detail.swellDirection} deg={conditions.swellDirectionDeg} />` e `<DirRow label={t.sessions.detail.windDirection} deg={conditions.windDirectionDeg} />`. A linha da maré:

```tsx
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t.sessions.detail.tidePhase}</Text>
            <View style={styles.valueWithIcon}>
              {conditions.tidePhase !== null && (
                <TideIcon phase={conditions.tidePhase} size={14} color={theme.colors.ink} />
              )}
              <Text style={styles.rowValue}>
                {conditions.tidePhase !== null ? t.sessions.tide[conditions.tidePhase] : DASH}
              </Text>
            </View>
          </View>
```

Estilo novo em `makeStyles`: `valueWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 4 },`

O helper `dir` deixa de ser usado — **apagar** (não deixar código morto).

- [ ] **Step 8: Verificar**

Run: `npx tsc --noEmit`
Expected: zero erros.

Run: `npm test`
Expected: 100/100 verdes (96 + 4 novos).

- [ ] **Step 9: Commit**

```bash
git add src/utils/directions.ts src/utils/__tests__/directions.test.ts src/components/DirectionArrow.tsx "src/app/(tabs)/index.tsx" "src/app/sessao/[id].tsx"
git commit -m "feat: setas de direcao e icones de mare no cartao e detalhe

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Fecho — DESIGN.md e BACKLOG.md

**Files:**
- Modify: `DESIGN.md`
- Modify: `BACKLOG.md`

**Interfaces:**
- Consumes: nada. Documentação do que as Tasks 1-5 fizeram.
- Produces: nada.

- [ ] **Step 1: Atualizar o DESIGN.md**

O DESIGN.md diz hoje "Modo escuro não é prioridade no MVP" e documenta um só tema. Substituir a nota de topo por uma secção que documente os dois temas: a tabela de tokens dos dois (copiar do spec, secção "Tokens"), a decisão da tipografia por tema (escolha explícita do utilizador, com o custo — troca de identidade entre temas e perda de tabular-nums no escuro), e o consumo via `useTheme()` (sem preferência persistida).

Acrescentar à tabela "Decisões e porquê":

| Decisão | Racional |
|---|---|
| Tipografia diferente por tema (Fraunces/JetBrains/Instrument no claro, Spectral/Archivo no escuro) | Escolha explícita do utilizador sobre o mockup "Carta Náutica" do README, com o custo assumido: a app troca de identidade com o tema e o escuro perde tabular-nums. |
| Tema segue o sistema, sem definição na app | O telemóvel já sabe se é de noite; uma definição seria UI e persistência sem valor acrescentado para o utilizador zero. |

- [ ] **Step 2: Atualizar o BACKLOG.md**

Na Fase 3, marcar como feitos e anotar:

```markdown
- [x] P0 — Ecrã principal: lista de sessões (cartão: spot, data, rating, mini-resumo de condições: altura • período • vento • maré) com paginação — FEITO na Fase 2 Tarefa 7 (commit 3d0169b). Paginação NÃO: `LIMIT 50` fixo, com `ponytail:` comment no sessionsStore — entra quando alguém passar as 50 sessões.
- [x] P0 — Detalhe de sessão: tudo, incluindo condições completas e notas — FEITO na Fase 2 Tarefa 7 (commit 3d0169b).
- [ ] P1 — Filtros: por spot, por rating mínimo — ADIADO (2026-07-16): com <5 sessões, filtrar filtra o que já cabe no ecrã. Entra quando o histórico irritar.
- [ ] P1 — Ecrã de spot: sessões desse spot + contagem por rating — ADIADO (2026-07-16): é o embrião do ecrã de insights da Fase 4; a forma certa só se vê com sessões reais.
- [ ] P1 — Onboarding mínimo: 2 ecrãs (o que é a Maré, criar primeiro spot) — ADIADO (2026-07-16): valor zero para o utilizador zero; o valor aparece no Beta Pessoal com os testers.
- [x] P2 — Dark mode — tema "Carta Náutica" (README), segue o sistema via useColorScheme, tipografia própria por decisão do utilizador.
- [x] P2 — Ícones de direção (seta rodada por `*_direction_deg`) e fase da maré — seta = rumo+180° (a API dá "de onde vem"), com teste.
```

- [ ] **Step 3: Commit**

```bash
git add DESIGN.md BACKLOG.md
git commit -m "docs: DESIGN.md com os dois temas e BACKLOG da Fase 3 atualizado

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## DoD no dispositivo (o utilizador valida no fim)

1. Trocar o tema do sistema para escuro com a app aberta → a app inteira muda de fundo, cor e tipografia, sem reiniciar e sem flash de fonte.
2. Percorrer os 9 ecrãs nos dois temas — nenhum fundo branco, nenhum texto ilegível, nenhuma fonte de sistema (todos os textos são Spectral/Archivo no escuro).
3. Um cartão com condições `ok`: a seta do vento aponta para onde o vento vai (vento "de NO" → seta para SE/baixo-direita) e a maré tem seta a subir/descer.
4. `npx tsc --noEmit` limpo e 100/100 testes verdes.

## Notas de comportamento assumidas (não são gaps)

- **Tabular-nums no escuro:** Archivo não é monoespaçada; os números do mar "saltam" de largura entre cartões no tema escuro. Custo conhecido da decisão de tipografia por tema.
- **`useTheme()` em componentes-folha:** chamar o hook em `Chip`/`Stars`/`Row` (em vez de passar o tema por prop) é deliberado — `useColorScheme` é barato e evita props de tema a atravessar todos os componentes.
- **`success` no escuro** aponta para o mesmo azul do acento: o README não define token de sucesso para a Carta Náutica, e não há UI de sucesso hoje (o token existe mas não é usado por nenhum ecrã).
