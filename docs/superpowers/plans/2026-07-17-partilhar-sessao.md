# Partilhar sessão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A partir do ecrã de Detalhe, um botão "Partilhar" gera uma imagem do cartão da sessão (identidade Maré, tema ativo) e abre o share sheet nativo.

**Architecture:** A decisão do que aparece vive numa função pura testável (`buildShareCardModel`); o `ShareCard` só desenha o modelo; a fronteira nativa é só `captureRef + shareAsync`. A técnica de risco (capturar uma view fora do ecrã) é provada num spike no dispositivo ANTES de qualquer estilização — se falhar, muda-se para plano B.

**Tech Stack:** React Native 0.86 + Expo SDK 57, TypeScript strict, Jest + better-sqlite3. Deps novas: `react-native-view-shot`, `expo-sharing` (ambas no bundledNativeModules do SDK 57).

**Spec:** `docs/superpowers/specs/2026-07-17-partilhar-sessao-design.md`

## Global Constraints

- Strings de UI em pt-PT via `src/i18n` — nunca hardcoded (CLAUDE.md).
- Identificadores em inglês; comentários de código em pt-PT.
- Zero cores/fontes hardcoded — tudo de `Theme` via `useTheme()`; `space`/`radius` importados.
- Deps novas só via `expo install`, com justificação no commit: `react-native-view-shot`, `expo-sharing`. **Nenhuma outra** — em particular NÃO `expo-media-library`.
- **Erros de partilha nunca bloqueiam nada** — cancelar o share sheet é estado normal, como o fetch de condições falhar (CLAUDE.md).
- **Gate de tipos: `npx tsc --noEmit`.** O Jest é babel-jest e NÃO type-checka.
- Testes obrigatórios só para `buildShareCardModel` (lógica pura). `ShareCard`/`shareSession` sem testes (nativo — mocká-lo testaria o mock). Suite fica em 118 + os novos.
- Deps nativas exigem **rebuild do dev client** (`npx expo run:android`/`ios`) — não chegam por Metro. O DoD do spike é no dispositivo.
- Commits: conventional commits com trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Estrutura de ficheiros

| Ficheiro | Responsabilidade | Tarefa |
|---|---|---|
| `package.json` | 2 deps novas (via expo install) | 1 |
| `src/app/sessao/[id].tsx` | spike temporário (T1) → botão + captura real (T4) | 1, 4 |
| `src/services/share/shareCardModel.ts` | `buildShareCardModel` (puro) | 2 |
| `src/services/share/__tests__/shareCardModel.test.ts` | testes do modelo | 2 |
| `src/components/ShareCard.tsx` | render do modelo | 3 |
| `src/services/share/shareSession.ts` | `captureRef` + `shareAsync` | 4 |
| `src/i18n/index.ts` | `t.sessions.share` | 4 |

---

### Task 1: Spike — provar a captura fora do ecrã (GATE)

**Files:**
- Modify: `package.json` (via expo install)
- Modify: `src/app/sessao/[id].tsx` (código TEMPORÁRIO, removido na Task 4)

**Interfaces:**
- Consumes: nada.
- Produces: a confirmação (ou não) de que `captureRef` de uma view deslocada funciona no dispositivo. **Nenhuma API que outra tarefa consuma** — é um teste descartável.

**Esta tarefa PÁRA para validação no dispositivo. Nenhuma tarefa seguinte arranca sem o "verde" do Bruno.**

- [ ] **Step 1: Instalar as deps**

```bash
npx expo install react-native-view-shot expo-sharing
```
Expected: instala `react-native-view-shot@5.1.x` e `expo-sharing@~57.0.x` no `package.json`.

- [ ] **Step 2: Rebuild do dev client**

```bash
npx expo run:android
```
(ou `run:ios`). Obrigatório: as deps são nativas, não chegam por Metro. Expected: a app reconstrói e arranca no dispositivo/emulador.

- [ ] **Step 3: Spike temporário no ecrã de detalhe**

Em `src/app/sessao/[id].tsx`, acrescentar código **claramente marcado como temporário** — imports, um `ref`, uma view mínima fora do ecrã, e um botão que dispara a captura. No topo:

```tsx
// SPIKE TEMPORÁRIO (remover na Task 4) — provar captureRef fora do ecrã.
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useRef } from 'react';
```

Dentro do `SessionDetailScreen`, a seguir aos hooks:
```tsx
  const spikeRef = useRef<View>(null);
  async function runSpike() {
    try {
      const uri = await captureRef(spikeRef, { format: 'png', quality: 1, pixelRatio: 3 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png' });
    } catch (e) {
      console.warn('[spike] captura:', e);
    }
  }
```

No JSX, como primeiro filho do `ScrollView` (a view fica fora do ecrã via posição absoluta negativa):
```tsx
      {/* SPIKE TEMPORÁRIO (remover na Task 4) */}
      <View
        ref={spikeRef}
        collapsable={false}
        style={{ position: 'absolute', left: -9999, top: 0, width: 300, height: 150, backgroundColor: theme.colors.surface, padding: 16 }}
      >
        <Text style={{ fontFamily: theme.font.displaySemiBold, fontSize: 22, color: theme.colors.ink }}>Maré · spike</Text>
        <Text style={{ fontFamily: theme.font.mono, fontSize: 16, color: theme.colors.accent }}>1.2 m · 15 s</Text>
      </View>
      <Pressable onPress={() => void runSpike()} style={{ padding: 12, backgroundColor: theme.colors.accent, borderRadius: 8, margin: 16 }}>
        <Text style={{ fontFamily: theme.font.bodySemiBold, color: theme.colors.accentOn, textAlign: 'center' }}>SPIKE partilhar</Text>
      </Pressable>
```

Nota: `collapsable={false}` é obrigatório no Android — sem ele o RN pode otimizar a view para fora da árvore nativa e o `captureRef` falha.

- [ ] **Step 4: Verificar que não parte a build**

Run: `npx tsc --noEmit`
Expected: zero erros.

Run: `npm test`
Expected: 118/118 (o spike não toca em nada testado).

- [ ] **Step 5: Commit do spike**

```bash
git add package.json package-lock.json "src/app/sessao/[id].tsx"
git commit -m "spike: provar captureRef fora do ecra antes de construir o ShareCard

Deps novas: react-native-view-shot + expo-sharing (bundledNativeModules do
SDK 57). Codigo temporario, removido na tarefa do botao real.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: PARAR — DoD do spike no dispositivo**

O Bruno corre a app e toca "SPIKE partilhar". **DoD:** o share sheet abre com uma imagem válida (não em branco, não esborratada). O implementador reporta e **espera** pela confirmação.

- **Verde** → segue para a Task 2.
- **Vermelho** (imagem em branco / share sheet não abre) → **PARAR e reportar ao controlador**. O plano B (ecrã de pré-visualização real em vez de view fora do ecrã) exige replanear as Tasks 3-4 — não improvisar.

---

### Task 2: `buildShareCardModel` (TDD)

**Files:**
- Create: `src/services/share/shareCardModel.ts`
- Create: `src/services/share/__tests__/shareCardModel.test.ts`

**Interfaces:**
- Consumes: `SessionListItem`, `SessionConditions` de `src/db/types.ts`; `degToCardinal` de `src/utils/directions.ts`; `t.sessions.tide` de `src/i18n`.
- Produces (a Task 3 depende, verbatim):
```ts
export interface ShareCardModel {
  spotName: string;
  startedAt: number;
  rating: number;
  meta: string[];
  hero: { swell: string; period: string } | null;
  context: string | null;
}
export function buildShareCardModel(
  session: SessionListItem,
  conditions: SessionConditions | null,
): ShareCardModel;
```

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/services/share/__tests__/shareCardModel.test.ts`:

```ts
import { type SessionConditions, type SessionListItem } from '../../../db/types';
import { buildShareCardModel } from '../shareCardModel';

function session(over: Partial<SessionListItem> = {}): SessionListItem {
  return {
    id: 's1', spotId: 'spot-1', boardId: null, startedAt: 1_700_000_000,
    durationMin: null, rating: 4, crowd: null, notes: null, createdAt: 1, updatedAt: 1,
    spotName: 'Carcavelos', boardName: null, swellHeightM: null, swellPeriodS: null,
    windSpeedKmh: null, windDirectionDeg: null, tidePhase: null, fetchStatus: 'ok',
    ...over,
  };
}

function conditions(over: Partial<SessionConditions> = {}): SessionConditions {
  return {
    sessionId: 's1', waveHeightM: null, waveDirectionDeg: null, wavePeriodS: null,
    swellHeightM: null, swellDirectionDeg: null, swellPeriodS: null, swellPeakPeriodS: null,
    windWaveHeightM: null, seaLevelMslM: null, tidePhase: null, waterTempC: null,
    windSpeedKmh: null, windGustsKmh: null, windDirectionDeg: null, windRelation: null,
    fetchStatus: 'ok', retryCount: 0, fetchedAt: null, source: 'open-meteo', rawJson: null,
    ...over,
  };
}

describe('buildShareCardModel', () => {
  test('sessão completa: hero + contexto + meta', () => {
    const m = buildShareCardModel(
      session({ boardName: '6\'2 Lost', durationMin: 55 }),
      conditions({ swellHeightM: 1.2, swellPeriodS: 15, windSpeedKmh: 16, windDirectionDeg: 0, tidePhase: 'falling' }),
    );
    expect(m.spotName).toBe('Carcavelos');
    expect(m.rating).toBe(4);
    expect(m.meta).toEqual(['6\'2 Lost', '55 min']);
    expect(m.hero).toEqual({ swell: '1.2 m', period: '15 s' });
    expect(m.context).toBe('16 km/h N · a vazar');
  });

  test('pending (sem conditions) → hero e contexto null, mas meta e cabeçalho ficam', () => {
    const m = buildShareCardModel(session({ boardName: 'Fish', fetchStatus: 'pending' }), null);
    expect(m.hero).toBeNull();
    expect(m.context).toBeNull();
    expect(m.meta).toEqual(['Fish']);
    expect(m.spotName).toBe('Carcavelos');
  });

  test('ok mas sem swell → hero null (não inventa)', () => {
    const m = buildShareCardModel(session(), conditions({ windSpeedKmh: 10, windDirectionDeg: 90 }));
    expect(m.hero).toBeNull();
    expect(m.context).toBe('10 km/h E');
  });

  test('meta vazia quando não há prancha nem duração', () => {
    expect(buildShareCardModel(session(), null).meta).toEqual([]);
  });

  test('contexto parcial: só vento (sem maré) e só maré (sem vento)', () => {
    expect(buildShareCardModel(session(), conditions({ windSpeedKmh: 20, windDirectionDeg: 180 })).context).toBe('20 km/h S');
    expect(buildShareCardModel(session(), conditions({ tidePhase: 'rising' })).context).toBe('a encher');
  });

  test('vento sem direção → só a velocidade', () => {
    expect(buildShareCardModel(session(), conditions({ windSpeedKmh: 12 })).context).toBe('12 km/h');
  });
});
```

- [ ] **Step 2: Correr e ver falhar**

Run: `npm test -- shareCardModel`
Expected: FAIL — `Cannot find module '../shareCardModel'`.

- [ ] **Step 3: Implementar**

Criar `src/services/share/shareCardModel.ts`:

```ts
import { type SessionConditions, type SessionListItem } from '../../db/types';
import { t } from '../../i18n';
import { degToCardinal } from '../../utils/directions';

// Modelo puro do cartão de partilha: decide O QUE aparece, sem JSX nem nativo.
// O cartão de partilha OMITE ausências (ao contrário do detalhe, que mostra
// "—"): uma imagem para partilhar não deve exibir buracos.
export interface ShareCardModel {
  spotName: string;
  startedAt: number;
  rating: number;
  meta: string[]; // prancha, duração — só os que existem
  hero: { swell: string; period: string } | null; // null se pending/sem swell
  context: string | null; // vento + maré, o que houver; null se nada
}

export function buildShareCardModel(
  session: SessionListItem,
  conditions: SessionConditions | null,
): ShareCardModel {
  const meta = [
    session.boardName,
    session.durationMin !== null ? `${session.durationMin} min` : null,
  ].filter((x): x is string => x !== null);

  // Hero só com swell E período reais (a leitura discriminante do spot). Sem
  // conditions (pending) ou sem swell, não há hero — não se inventa.
  const hero =
    conditions !== null && conditions.swellHeightM !== null && conditions.swellPeriodS !== null
      ? { swell: `${conditions.swellHeightM} m`, period: `${conditions.swellPeriodS} s` }
      : null;

  // Contexto: vento (com direção cardeal se houver) e/ou maré, juntos por "·".
  let context: string | null = null;
  if (conditions !== null) {
    const parts: string[] = [];
    if (conditions.windSpeedKmh !== null) {
      const dir = conditions.windDirectionDeg !== null ? ` ${degToCardinal(conditions.windDirectionDeg)}` : '';
      parts.push(`${conditions.windSpeedKmh} km/h${dir}`);
    }
    if (conditions.tidePhase !== null) {
      parts.push(t.sessions.tide[conditions.tidePhase]);
    }
    context = parts.length > 0 ? parts.join(' · ') : null;
  }

  return {
    spotName: session.spotName,
    startedAt: session.startedAt,
    rating: session.rating,
    meta,
    hero,
    context,
  };
}
```

- [ ] **Step 4: Correr e ver passar**

Run: `npm test -- shareCardModel`
Expected: PASS, 6 testes.

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 5: Commit**

```bash
git add src/services/share/shareCardModel.ts src/services/share/__tests__/shareCardModel.test.ts
git commit -m "feat: buildShareCardModel puro (decide o que o cartao de partilha mostra)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `ShareCard.tsx` — render do modelo

**Files:**
- Create: `src/components/ShareCard.tsx`

**Interfaces:**
- Consumes: `ShareCardModel` (Task 2), `useTheme()`/`Theme`, `fmtLocal` de `src/utils/format`, `Ionicons`.
- Produces: `export const ShareCard = forwardRef<View, { model: ShareCardModel }>(...)` — a Task 4 passa-lhe o `ref` para a captura.

Sem testes (UI). O `ref` é o que o `captureRef` da Task 4 vai capturar.

- [ ] **Step 1: Criar o componente**

Criar `src/components/ShareCard.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { type ShareCardModel } from '../services/share/shareCardModel';
import { fmtLocal } from '../utils/format';
import { type Theme, useTheme, radius, space } from '../theme';

// "Print emoldurado" do mockup (t14): leitura hero limpa + marca Maré. Sem
// lógica de decisão — recebe o modelo pronto (buildShareCardModel) e desenha.
// O ref é o alvo do captureRef (Task 4); daí o forwardRef.
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
```

Nota: `makeStyles(theme)` sem `useMemo` — o `ShareCard` monta-se uma vez para a captura, não re-renderiza numa lista. `collapsable={false}` para o Android manter a view na árvore nativa (o `captureRef` precisa dela).

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: zero erros.

Run: `npm test`
Expected: 124/124 (118 + 6 da Task 2).

- [ ] **Step 3: Commit**

```bash
git add src/components/ShareCard.tsx
git commit -m "feat: ShareCard renderiza o modelo de partilha nos tokens do tema ativo

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Ligar tudo — botão real + captura (remove o spike)

**Files:**
- Create: `src/services/share/shareSession.ts`
- Modify: `src/app/sessao/[id].tsx` (remove o spike, liga o real)
- Modify: `src/i18n/index.ts`

**Interfaces:**
- Consumes: `ShareCard` (Task 3), `buildShareCardModel` (Task 2), `captureRef`/`shareAsync`.
- Produces: nada.

- [ ] **Step 1: A fronteira nativa**

Criar `src/services/share/shareSession.ts`:

```ts
import * as Sharing from 'expo-sharing';
import { type RefObject } from 'react';
import { type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

// A única fronteira intestável (nativo). captureRef → PNG no cache →
// shareAsync. Falhar aqui NÃO parte nada: o utilizador cancelar o share sheet
// é estado normal, como o fetch de condições falhar (CLAUDE.md).
export async function shareSession(ref: RefObject<View>): Promise<void> {
  try {
    // Densidade: o react-native-view-shot@5.1.0 NÃO tem `pixelRatio` (o plano
    // original assumia uma versão diferente — corrigido no spike). Esta versão
    // controla a resolução do output por `width`: o ShareCard mede 340pt de
    // largura, capturamos a 1020 (3×) e a altura escala pelo rácio, mantendo o
    // cartão nítido em ecrãs retina sem fixar uma altura que varia com o
    // estado (pending não tem hero). mimeType explícito: o default nem sempre
    // é reconhecido pelo share sheet do Android.
    const uri = await captureRef(ref, { format: 'png', quality: 1, width: 1020 });
    await Sharing.shareAsync(uri, { mimeType: 'image/png' });
  } catch (e) {
    console.warn('[share] sessão:', e);
  }
}
```

- [ ] **Step 2: i18n**

Em `src/i18n/index.ts`, dentro do bloco `sessions`, a seguir a `retryFetch`:
```ts
    share: 'Partilhar',
```

- [ ] **Step 3: Remover o spike e ligar o real**

Em `src/app/sessao/[id].tsx`:

1. **Remover** todo o código marcado `SPIKE TEMPORÁRIO` (os 3 imports do topo, o `spikeRef`/`runSpike`, a view fora do ecrã e o botão do spike).
2. Imports novos:
```tsx
import { useRef } from 'react';
import { ShareCard } from '../../components/ShareCard';
import { buildShareCardModel } from '../../services/share/shareCardModel';
import { shareSession } from '../../services/share/shareSession';
```
(Se `useRef` já foi importado pelo spike, mantê-lo; senão juntá-lo ao import de `react`.)

3. Dentro do `SessionDetailScreen`, a seguir aos hooks — o modelo constrói-se do que o ecrã já tem (`session` e `conditions`):
```tsx
  const shareRef = useRef<View>(null);
  const shareModel = buildShareCardModel(session, conditions);
```
(`session` e `conditions` já existem no ecrã — `View` está importado de `react-native`, `conditions` é `SessionConditions | null` e começa `null` até o `useEffect` de carregamento resolver. Reconstruir o modelo em cada render é deliberado e barato: é uma função pura sobre dois objetos, e quando `conditions` chega o cartão passa a ter hero sem gesto nenhum. Sem `useMemo` — seria cerimónia por micro-otimização.)

4. No JSX, o `ShareCard` fora do ecrã (posição absoluta), como primeiro filho do `ScrollView`:
```tsx
      <View style={styles.offscreen} pointerEvents="none">
        <ShareCard ref={shareRef} model={shareModel} />
      </View>
```

5. O botão "Partilhar" — no header, ao lado do lápis "Editar". Onde hoje está o `headerRight` com um só ícone, passar a dois:
```tsx
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable onPress={() => void shareSession(shareRef)} hitSlop={8}>
                <Ionicons name="share-outline" size={22} color={theme.colors.ink} />
              </Pressable>
              <Pressable onPress={() => router.push(`/sessao/editar/${session.id}`)} hitSlop={8}>
                <Ionicons name="create-outline" size={22} color={theme.colors.ink} />
              </Pressable>
            </View>
          ),
        }}
      />
```

6. Estilos novos em `makeStyles`:
```tsx
    offscreen: { position: 'absolute', left: -9999, top: 0 },
    headerActions: { flexDirection: 'row', gap: space.md },
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit`
Expected: zero erros. **Confirmar que nenhum resto do spike ficou** (sem `spikeRef`, `runSpike`, `captureRef`/`Sharing` importados direto no ecrã — a captura agora vive só no `shareSession`).

Run: `npm test`
Expected: 124/124.

- [ ] **Step 5: Commit**

```bash
git add src/services/share/shareSession.ts src/i18n/index.ts "src/app/sessao/[id].tsx"
git commit -m "feat: botao Partilhar no detalhe com captura do ShareCard fora do ecra

Remove o spike da Tarefa 1. captureRef+shareAsync isolados em shareSession.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Fecho — BACKLOG/DESIGN

**Files:**
- Modify: `DESIGN.md`

**Interfaces:** Consumes/Produces: nada.

- [ ] **Step 1: Registar no DESIGN.md**

Acrescentar à tabela "Decisões e porquê" do `DESIGN.md`:

| Decisão | Racional |
|---|---|
| Partilhar sessão: cartão dedicado (`ShareCard`) capturado fora do ecrã, não o ecrã de detalhe | O detalhe tem grid de 12 medidas + botões; a imagem de partilha é o "print emoldurado" do mockup t14 — leitura hero limpa + marca Maré. Tema ativo (claro partilha claro). |
| A decisão do que a imagem mostra vive em `buildShareCardModel` (puro, testado); o `ShareCard` só desenha | Reduz a fronteira intestável (nativo) a `captureRef`+`shareAsync`; a lógica de omitir ausências fica coberta por testes. |

E uma linha sobre a T15 adiada, para não se perder:
```markdown
**T15 (definições de unidades) — adiada (2026-07-17):** exige persistência de
preferências (inexistente no projeto) + threading das unidades por 8+ sítios.
Sem beta a começar e com o utilizador zero em métrico, o custo não se justifica.
Retomar quando um tester precisar de pés/nós.
```

- [ ] **Step 2: Commit**

```bash
git add DESIGN.md
git commit -m "docs: registar decisoes de partilhar sessao e o adiamento da T15

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## DoD no dispositivo

1. **(Task 1, gate)** Spike: captura mínima fora do ecrã → share sheet com imagem válida.
2. Detalhe → "Partilhar" → share sheet com a imagem do cartão (identidade Maré, tema ativo).
3. Uma sessão pending partilha na mesma — sem hero, sem partir.
4. Cancelar o share sheet não deixa a app estranha.
5. Nos dois temas (claro partilha claro, escuro escuro).

## Notas de comportamento assumidas (não são gaps)

- **`ShareCard` fora do ecrã**: `position: absolute, left: -9999` + `collapsable={false}` + `pointerEvents="none"`. Se o spike (Task 1) mostrar que isto não captura nalgum dispositivo, é plano B (ecrã de preview) — decidido antes das Tasks 3-4.
- **Sem `useMemo` no `makeStyles` do ShareCard**: monta-se uma vez para a captura, não numa lista.
- **Cancelar a partilha é silencioso**: sem alerta, sem mensagem — não é erro.
