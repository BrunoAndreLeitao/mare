# Fecho de dívida de design + empty state + editar sessão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar os formulários de spot/prancha para o design system, dar ícone+CTA ao empty state das sessões, e criar o ecrã "Editar sessão" reutilizando `sessionRepo.update`.

**Architecture:** A dívida de design vive nos componentes partilhados `SpotForm`/`BoardForm` (não nos ecrãs wrapper); a edição de sessão nasce como rota nova `sessao/editar/[id]` com um `SessionForm` extraído de `sessao/nova.tsx`, um tipo `SessionChanges` (padrão `SpotChanges`) e uma ação `update` na store. A invalidação de condições (Regra 3) já vive em `sessionRepo.update` — nenhum ecrã a duplica.

**Tech Stack:** React Native + Expo (expo-router, Zustand, expo-sqlite), Jest + better-sqlite3 nos testes de repo. TypeScript `strict`, sem `any`.

**Spec:** `docs/superpowers/specs/2026-07-15-design-debt-empty-state-editar-sessao-design.md`

## Global Constraints

- Strings de UI em pt-PT via `src/i18n` — nunca hardcoded nos componentes (CLAUDE.md).
- Identificadores em inglês; datas em epoch seconds UTC; conversão local só na apresentação.
- Tokens visuais só de `src/theme.ts` (`colors`, `font`, `space`, `radius`) — zero cores/fontes novas.
- Zero dependências novas.
- UI sem testes (MVP); teste obrigatório apenas para o repo (null-clear via `SessionChanges`).
- Commits: conventional commits.
- Verificação por tarefa: `npx tsc --noEmit` limpo e `npm test` verde.

---

### Task 1: Recolorir SpotForm/BoardForm + botões de arquivar (peça A)

**Files:**
- Modify: `src/components/SpotForm.tsx`
- Modify: `src/components/BoardForm.tsx`
- Modify: `src/app/spot/[id].tsx`
- Modify: `src/app/board/[id].tsx`

**Interfaces:**
- Consumes: tokens de `src/theme.ts`; estilos de referência de `src/app/sessao/nova.tsx`.
- Produces: nada novo — só estilo. Props e comportamento dos formulários ficam intocados.

Sem testes (UI, MVP). Estilos copiados de `sessao/nova.tsx`: labels uppercase, inputs `hairline`, chips `radius.chip` com seleção `accent`, botão submit = `registerButton`. Ações secundárias ("Usar a minha localização") e destrutivas (arquivar) usam o estilo de link já existente (`retry` em `(tabs)/index.tsx`): `bodySemiBold` sublinhado, em `accent` e `error` respetivamente.

- [ ] **Step 1: Reescrever os estilos e botões do SpotForm**

Substituir o conteúdo de `src/components/SpotForm.tsx` por:

```tsx
import * as Location from 'expo-location';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { t } from '../i18n';
import { parseDecimal, validateCoords } from '../utils/coords';
import { colors, font, radius, space } from '../theme';

export interface SpotFormValues {
  name: string;
  latitude: number;
  longitude: number;
  notes: string | null;
}

interface Props {
  initial?: SpotFormValues;
  submitLabel: string;
  /** Store/screen error rendered alongside local validation errors. */
  externalError?: string | null;
  onSubmit(values: SpotFormValues): void;
}

export function SpotForm({ initial, submitLabel, externalError, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [lat, setLat] = useState(initial !== undefined ? String(initial.latitude) : '');
  const [lon, setLon] = useState(initial !== undefined ? String(initial.longitude) : '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  // Permission is requested only here, on tap (CLAUDE.md: no upfront prompts).
  async function fillFromLocation() {
    setLocating(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError(t.spots.locationDenied);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setLat(pos.coords.latitude.toFixed(5));
      setLon(pos.coords.longitude.toFixed(5));
    } catch {
      setError(t.spots.locationFailed);
    } finally {
      setLocating(false);
    }
  }

  function submit() {
    if (name.trim() === '') {
      setError(`${t.spots.name}: ${t.common.required}`);
      return;
    }
    const latitude = parseDecimal(lat);
    const longitude = parseDecimal(lon);
    if (latitude === null || longitude === null) {
      setError(t.spots.coordsNotNumeric);
      return;
    }
    const coordsError = validateCoords(latitude, longitude);
    if (coordsError !== null) {
      setError(t.spots[coordsError]);
      return;
    }
    setError(null);
    const trimmedNotes = notes.trim();
    onSubmit({
      name: name.trim(),
      latitude,
      longitude,
      notes: trimmedNotes === '' ? null : trimmedNotes,
    });
  }

  const shownError = error ?? externalError ?? null;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {shownError !== null && <Text style={styles.error}>{shownError}</Text>}

      <Text style={styles.label}>{t.spots.name}</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={t.spots.namePlaceholder}
        placeholderTextColor={colors.inkMuted}
        autoFocus
      />

      <Text style={styles.label}>{t.spots.latitude}</Text>
      <TextInput
        style={styles.input}
        value={lat}
        onChangeText={setLat}
        // numbers-and-punctuation: PT longitudes are negative and iOS
        // decimal-pad has no minus sign; Android falls back to default.
        keyboardType="numbers-and-punctuation"
      />

      <Text style={styles.label}>{t.spots.longitude}</Text>
      <TextInput
        style={styles.input}
        value={lon}
        onChangeText={setLon}
        keyboardType="numbers-and-punctuation"
      />

      <Pressable
        onPress={() => void fillFromLocation()}
        disabled={locating}
        style={locating && styles.linkDisabled}
        hitSlop={8}
      >
        <Text style={styles.link}>{t.spots.useMyLocation}</Text>
      </Pressable>

      <Text style={styles.label}>{t.spots.notes}</Text>
      <TextInput
        style={[styles.input, styles.notes]}
        value={notes}
        onChangeText={setNotes}
        placeholder={t.spots.notesPlaceholder}
        placeholderTextColor={colors.inkMuted}
        multiline
      />

      <Pressable style={styles.submitButton} onPress={submit}>
        <Text style={styles.submitButtonLabel}>{submitLabel}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.md, gap: space.sm, backgroundColor: colors.background },
  label: {
    fontFamily: font.bodySemiBold,
    fontSize: 13,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: space.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: font.body,
    fontSize: 16,
    color: colors.ink,
  },
  notes: { minHeight: 80, textAlignVertical: 'top', fontStyle: 'italic' },
  link: {
    fontFamily: font.bodySemiBold,
    fontSize: 14,
    color: colors.accent,
    textDecorationLine: 'underline',
    marginVertical: space.sm,
  },
  linkDisabled: { opacity: 0.5 },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.input,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: space.sm,
  },
  submitButtonLabel: { fontFamily: font.bodySemiBold, fontSize: 16, color: colors.accentOn },
  error: { fontFamily: font.body, color: colors.error },
});
```

- [ ] **Step 2: Reescrever os estilos e botões do BoardForm**

Substituir o conteúdo de `src/components/BoardForm.tsx` por:

```tsx
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { type BoardType } from '../db/types';
import { t } from '../i18n';
import { parseDecimal } from '../utils/coords';
import { colors, font, radius, space } from '../theme';

export interface BoardFormValues {
  name: string;
  boardType: BoardType | null;
  volumeL: number | null;
}

interface Props {
  initial?: BoardFormValues;
  submitLabel: string;
  /** Store/screen error rendered alongside local validation errors. */
  externalError?: string | null;
  onSubmit(values: BoardFormValues): void;
}

const typeOptions = Object.entries(t.boards.types) as [BoardType, string][];

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress(): void;
}) {
  return (
    <Pressable style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

export function BoardForm({ initial, submitLabel, externalError, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [boardType, setBoardType] = useState<BoardType | null>(initial?.boardType ?? null);
  const [volume, setVolume] = useState(
    initial === undefined || initial.volumeL === null ? '' : String(initial.volumeL),
  );
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (name.trim() === '') {
      setError(`${t.boards.name}: ${t.common.required}`);
      return;
    }
    let volumeL: number | null = null;
    if (volume.trim() !== '') {
      const parsed = parseDecimal(volume);
      if (parsed === null || parsed <= 0) {
        setError(t.boards.volumeInvalid);
        return;
      }
      volumeL = parsed;
    }
    setError(null);
    onSubmit({ name: name.trim(), boardType, volumeL });
  }

  const shownError = error ?? externalError ?? null;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {shownError !== null && <Text style={styles.error}>{shownError}</Text>}

      <Text style={styles.label}>{t.boards.name}</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={t.boards.namePlaceholder}
        placeholderTextColor={colors.inkMuted}
        autoFocus
      />

      <Text style={styles.label}>{t.boards.type}</Text>
      <View style={styles.chips}>
        <Chip
          label={t.boards.typeNone}
          selected={boardType === null}
          onPress={() => setBoardType(null)}
        />
        {typeOptions.map(([value, label]) => (
          <Chip
            key={value}
            label={label}
            selected={boardType === value}
            onPress={() => setBoardType(value)}
          />
        ))}
      </View>

      <Text style={styles.label}>{t.boards.volume}</Text>
      <TextInput
        style={styles.input}
        value={volume}
        onChangeText={setVolume}
        keyboardType="decimal-pad"
      />

      <Pressable style={styles.submitButton} onPress={submit}>
        <Text style={styles.submitButtonLabel}>{submitLabel}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.md, gap: space.sm, backgroundColor: colors.background },
  label: {
    fontFamily: font.bodySemiBold,
    fontSize: 13,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: space.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: font.body,
    fontSize: 16,
    color: colors.ink,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.chip,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipLabel: { fontFamily: font.body, fontSize: 14, color: colors.ink },
  chipLabelSelected: { fontFamily: font.bodySemiBold, color: colors.accentOn },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.input,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: space.sm,
  },
  submitButtonLabel: { fontFamily: font.bodySemiBold, fontSize: 16, color: colors.accentOn },
  error: { fontFamily: font.body, color: colors.error },
});
```

- [ ] **Step 3: Botão de arquivar do spot/[id].tsx**

Em `src/app/spot/[id].tsx`:

Trocar o import de react-native:

```tsx
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
```

Acrescentar o import do tema (após os imports existentes do projeto):

```tsx
import { colors, font, space } from '../../theme';
```

Substituir o bloco do botão (o `<View style={styles.archive}>…</View>`) por:

```tsx
      <View style={styles.archive}>
        <Pressable onPress={() => confirmArchive(spot.id)} hitSlop={8}>
          <Text style={styles.archiveLabel}>{t.common.archive}</Text>
        </Pressable>
      </View>
```

Substituir o `StyleSheet.create` por:

```tsx
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  archive: { padding: space.md, alignItems: 'center' },
  archiveLabel: {
    fontFamily: font.bodySemiBold,
    fontSize: 14,
    color: colors.error,
    textDecorationLine: 'underline',
  },
});
```

- [ ] **Step 4: Botão de arquivar do board/[id].tsx**

Mesma mudança em `src/app/board/[id].tsx` (imports iguais aos do Step 3; `board.id` em vez de `spot.id`):

```tsx
      <View style={styles.archive}>
        <Pressable onPress={() => confirmArchive(board.id)} hitSlop={8}>
          <Text style={styles.archiveLabel}>{t.common.archive}</Text>
        </Pressable>
      </View>
```

E o mesmo `StyleSheet.create` do Step 3.

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit` — Expected: sem erros.
Run: `npm test` — Expected: suite toda verde (nenhum teste toca nestes componentes).

- [ ] **Step 6: Commit**

```bash
git add src/components/SpotForm.tsx src/components/BoardForm.tsx "src/app/spot/[id].tsx" "src/app/board/[id].tsx"
git commit -m "feat: migrar formularios de spot/prancha para o design system"
```

---

### Task 2: Empty state da lista de sessões (peça B)

**Files:**
- Modify: `src/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: estilos `registerButton`/`emptyBody` já existentes no ficheiro.
- Produces: nada — mudança local ao ecrã.

- [ ] **Step 1: Ícone + CTA no ListEmptyComponent e footer condicional**

Em `src/app/(tabs)/index.tsx`, substituir o `ListEmptyComponent` por:

```tsx
        ListEmptyComponent={
          <View style={styles.emptyBody}>
            <Ionicons name="water-outline" size={64} color={colors.inkMuted} />
            <Text style={styles.emptyTitle}>{t.sessions.emptyTitle}</Text>
            <Text style={styles.emptyText}>{t.sessions.emptyBody}</Text>
            <Pressable
              style={[styles.registerButton, styles.emptyCta]}
              onPress={() => router.push('/sessao/nova')}
            >
              <Text style={styles.registerButtonLabel}>{t.sessions.register}</Text>
            </Pressable>
          </View>
        }
```

Substituir o footer (decisão aprovada: escondido no vazio para não duplicar o CTA):

```tsx
      {sessions.length > 0 && (
        <View style={styles.footer}>
          <Pressable style={styles.registerButton} onPress={() => router.push('/sessao/nova')}>
            <Text style={styles.registerButtonLabel}>{t.sessions.register}</Text>
          </Pressable>
        </View>
      )}
```

Acrescentar ao `StyleSheet.create` (o `registerButton` de largura total encolhe para o conteúdo dentro do empty body centrado; o padding devolve-lhe corpo):

```tsx
  emptyCta: { paddingHorizontal: space.xl, marginTop: space.sm },
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit` — Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(tabs)/index.tsx"
git commit -m "feat: empty state das sessoes com icone e CTA; footer escondido no vazio"
```

---

### Task 3: SessionChanges + assinatura de sessionRepo.update (peça C, dados)

**Files:**
- Modify: `src/db/types.ts`
- Modify: `src/db/repositories/sessionRepo.ts`
- Test: `src/db/__tests__/sessionRepo.test.ts`

**Interfaces:**
- Consumes: `buildSetClause` (já trata `null` → SQL NULL e ignora `undefined`); `SESSION_COLUMN_MAP`.
- Produces: `interface SessionChanges { spotId?: string; boardId?: string | null; startedAt?: number; rating?: Rating; durationMin?: number | null; crowd?: Crowd | null; notes?: string | null }` em `src/db/types.ts`; `SessionRepository.update(id: string, changes: SessionChanges): Promise<Session>`. A Task 4 depende de ambos.

- [ ] **Step 1: Escrever o teste que falha (null-clear)**

Acrescentar a `src/db/__tests__/sessionRepo.test.ts`, dentro do `describe`, a seguir ao teste `(c)`:

```ts
  test('(k) update com null explícito limpa board_id/notes para NULL; campo ausente (undefined) não é tocado', async () => {
    const s = await repo.create({
      spotId: 'spot-1',
      boardId: 'board-1',
      startedAt: 111,
      durationMin: 90,
      rating: 4,
      notes: 'pumping',
    });

    await repo.update(s.id, { boardId: null, notes: null });

    const after = (await repo.getById(s.id))!;
    expect(after.boardId).toBeNull();
    expect(after.notes).toBeNull();
    expect(after.durationMin).toBe(90); // undefined = não tocado (semântica *Changes)
    // Nem boardId nem notes invalidam condições.
    expect(conditions(s.id)).toMatchObject({ fetch_status: 'pending' });
  });
```

- [ ] **Step 2: Correr o teste e vê-lo falhar**

Run: `npm test -- sessionRepo`
Expected: FAIL — erro de compilação TS no `repo.update(s.id, { boardId: null, notes: null })`: `Partial<NewSession>` não aceita `null` (`Type 'null' is not assignable to type 'string | undefined'`).

- [ ] **Step 3: Implementar SessionChanges e mudar a assinatura**

Em `src/db/types.ts`, a seguir à interface `NewSession`:

```ts
// Update input — same semantics as SpotChanges: undefined leaves a field
// untouched, explicit null clears it to SQL NULL. spotId, startedAt and rating
// are NOT NULL columns, so they cannot be cleared.
export interface SessionChanges {
  spotId?: string;
  boardId?: string | null;
  startedAt?: number;
  rating?: Rating;
  durationMin?: number | null;
  crowd?: Crowd | null;
  notes?: string | null;
}
```

Em `src/db/repositories/sessionRepo.ts`:

1. Acrescentar `type SessionChanges` ao import de `../types`.
2. O mapa de colunas passa a ser chaveado por `SessionChanges` (mesmas chaves de `NewSession`, o conteúdo não muda):

```ts
const SESSION_COLUMN_MAP: Record<keyof SessionChanges, string> = {
```

3. Na interface e na implementação, trocar a assinatura:

```ts
  update(id: string, changes: SessionChanges): Promise<Session>;
```

```ts
    async update(id: string, changes: SessionChanges): Promise<Session> {
```

O corpo de `update` não muda: `buildSetClause` já escreve SQL NULL para `null`, e a guarda de invalidação compara `!== undefined`, que continua correta (spotId/startedAt não admitem null no tipo).

- [ ] **Step 4: Correr os testes e vê-los passar**

Run: `npm test -- sessionRepo`
Expected: PASS — teste (k) novo verde, (a)–(j) intocados.

Run: `npx tsc --noEmit` — Expected: sem erros (os chamadores existentes passam `Partial<NewSession>`-shaped objects, que são atribuíveis a `SessionChanges`).

- [ ] **Step 5: Commit**

```bash
git add src/db/types.ts src/db/repositories/sessionRepo.ts src/db/__tests__/sessionRepo.test.ts
git commit -m "feat: SessionChanges com semantica null-clear no update de sessoes"
```

---

### Task 4: sessionsStore.update (peça C, estado)

**Files:**
- Modify: `src/stores/sessionsStore.ts`

**Interfaces:**
- Consumes: `SessionRepository.update(id, changes: SessionChanges)` da Task 3.
- Produces: `update(id: string, changes: SessionChanges): Promise<Session | null>` na `SessionsState` — a Task 6 chama isto do ecrã de edição.

Sem teste próprio (padrão das outras ações da store: try/catch fino sobre o repo, já testado).

- [ ] **Step 1: Acrescentar a ação update**

Em `src/stores/sessionsStore.ts`:

1. Acrescentar `type SessionChanges` ao import de `../db/types`.
2. Na interface `SessionsState`, a seguir a `create`:

```ts
  /** Edita e recarrega a lista. Returns the updated session, or null on failure (error is set). */
  update(id: string, changes: SessionChanges): Promise<Session | null>;
```

3. Na store, a seguir a `create`:

```ts
  async update(id, changes) {
    try {
      const repo = await getSessionRepo();
      const session = await repo.update(id, changes);
      set({ error: null });
      // A invalidação de condições (Regra 3) é do repo; aqui só refletimos o
      // resultado — o load garante lista e detalhe frescos ao voltar.
      await get().load();
      return session;
    } catch {
      set({ error: t.common.genericError });
      return null;
    }
  },
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit` — Expected: sem erros.
Run: `npm test` — Expected: verde.

- [ ] **Step 3: Commit**

```bash
git add src/stores/sessionsStore.ts
git commit -m "feat: acao update na sessionsStore"
```

---

### Task 5: Extrair SessionForm de sessao/nova.tsx (peça C, formulário)

**Files:**
- Create: `src/components/SessionForm.tsx`
- Modify: `src/app/sessao/nova.tsx`

**Interfaces:**
- Consumes: tipos `Spot`, `Board`, `Rating` de `src/db/types.ts`; tokens de `src/theme.ts`.
- Produces (a Task 6 depende disto):

```ts
export interface SessionFormValues {
  spotId: string;
  startedAt: number; // epoch seconds UTC
  rating: Rating;
  boardId: string | null;
  durationMin: number | null;
  notes: string | null;
}
// Props: { spots: Spot[]; boards: Board[]; defaultSpotId?: string | null;
//          initial?: SessionFormValues; submitLabel: string;
//          externalError?: string | null; onSubmit(values: SessionFormValues): void }
export function SessionForm(props: Props): JSX.Element;
```

Refactor sem mudança de comportamento em `nova.tsx`: chips, picker de data/hora em dois passos, rating com scroll-to-error e validação movem-se para o componente; pré-seleção do último spot (via prop `defaultSpotId`), empty state "sem spots" e trigger pós-create ficam no ecrã.

- [ ] **Step 1: Criar src/components/SessionForm.tsx**

```tsx
import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { type Board, type Rating, type Spot } from '../db/types';
import { t } from '../i18n';
import { fmtLocal } from '../utils/format';
import { colors, font, radius, space } from '../theme';

const OFFSETS = [0, 1, 2, 3] as const;
const DURATIONS = [30, 60, 90, 120] as const;
const MAX_PAST_DAYS = 92; // teto do past_days da Open-Meteo (docs/OPEN_METEO.md §4)

export interface SessionFormValues {
  spotId: string;
  startedAt: number; // epoch seconds UTC
  rating: Rating;
  boardId: string | null;
  durationMin: number | null;
  notes: string | null;
}

interface Props {
  spots: Spot[];
  boards: Board[];
  /** Pré-seleção quando não há `initial` (último spot usado); com `initial` é ignorado. */
  defaultSpotId?: string | null;
  initial?: SessionFormValues;
  submitLabel: string;
  /** Erro de SISTEMA (dono: o submit do ecrã) — renderizado junto ao botão. */
  externalError?: string | null;
  onSubmit(values: SessionFormValues): void;
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress(): void;
}) {
  return (
    <Pressable style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

export function SessionForm({
  spots,
  boards,
  defaultSpotId,
  initial,
  submitLabel,
  externalError,
  onSubmit,
}: Props) {
  const [spotId, setSpotId] = useState<string | null>(initial?.spotId ?? null);
  // Em edição, a hora entra como data custom selecionada (offsetH=null).
  const [offsetH, setOffsetH] = useState<number | null>(initial !== undefined ? null : 0);
  const [customDate, setCustomDate] = useState<Date | null>(
    initial !== undefined ? new Date(initial.startedAt * 1000) : null,
  );
  const [pickerStep, setPickerStep] = useState<'date' | 'time' | null>(null);
  const [pickerDraft, setPickerDraft] = useState<Date>(new Date());
  const [rating, setRating] = useState<Rating | null>(initial?.rating ?? null);
  const [boardId, setBoardId] = useState<string | null>(initial?.boardId ?? null);
  const [duration, setDuration] = useState<number | null>(initial?.durationMin ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  // Erro de VALIDAÇÃO (dono: o campo) — renderiza sob as estrelas. O erro de
  // SISTEMA (dono: o submit) é o externalError, renderizado junto ao botão.
  const [validationError, setValidationError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const ratingY = useRef(0);

  // Pré-seleção: último usado se ainda ativo, senão o primeiro da lista.
  useEffect(() => {
    if (spotId === null && spots.length > 0) {
      const preferred = spots.find((s) => s.id === defaultSpotId);
      setSpotId((preferred ?? spots[0]).id);
    }
  }, [spots, defaultSpotId, spotId]);

  function onPickerValueChange(_event: DateTimePickerChangeEvent, picked: Date) {
    if (pickerStep === 'date') {
      setPickerDraft(picked);
      setPickerStep('time'); // Android: data e hora em dois passos
      return;
    }
    setCustomDate(picked);
    setOffsetH(null);
    setPickerStep(null);
  }

  function startedAtEpoch(): number {
    if (customDate !== null && offsetH === null) {
      return Math.floor(customDate.getTime() / 1000);
    }
    return Math.floor(Date.now() / 1000) - (offsetH ?? 0) * 3_600;
  }

  function submit() {
    if (spotId === null) return;
    if (rating === null) {
      setValidationError(t.sessions.ratingRequired);
      // O erro vai ter com o utilizador, não o contrário.
      scrollRef.current?.scrollTo({ y: ratingY.current, animated: true });
      return;
    }
    setValidationError(null);
    const trimmedNotes = notes.trim();
    onSubmit({
      spotId,
      startedAt: startedAtEpoch(),
      rating,
      boardId,
      durationMin: duration,
      notes: trimmedNotes === '' ? null : trimmedNotes,
    });
  }

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.label}>{t.sessions.spot}</Text>
      <View style={styles.chips}>
        {spots.map((spot) => (
          <Chip
            key={spot.id}
            label={spot.name}
            selected={spotId === spot.id}
            onPress={() => setSpotId(spot.id)}
          />
        ))}
      </View>

      <Text style={styles.label}>{t.sessions.when}</Text>
      <View style={styles.chips}>
        {OFFSETS.map((h) => (
          <Chip
            key={h}
            label={h === 0 ? t.sessions.now : t.sessions.hoursAgo(h)}
            selected={offsetH === h}
            onPress={() => {
              setOffsetH(h);
              setCustomDate(null);
            }}
          />
        ))}
        <Chip
          label={t.sessions.otherTime}
          selected={offsetH === null}
          onPress={() => {
            setPickerDraft(customDate ?? new Date());
            setPickerStep('date');
          }}
        />
      </View>
      <Text style={styles.whenPreview}>{fmtLocal(new Date(startedAtEpoch() * 1000))}</Text>
      {pickerStep !== null && (
        <DateTimePicker
          value={pickerDraft}
          mode={pickerStep}
          maximumDate={new Date()}
          minimumDate={new Date(Date.now() - MAX_PAST_DAYS * 86_400_000)}
          onValueChange={onPickerValueChange}
          onDismiss={() => setPickerStep(null)}
        />
      )}

      <View onLayout={(e) => (ratingY.current = e.nativeEvent.layout.y)}>
        <Text style={styles.label}>{t.sessions.rating}</Text>
        <View style={styles.stars}>
          {([1, 2, 3, 4, 5] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => {
                setRating(value);
                setValidationError(null);
              }}
              hitSlop={6}
            >
              <Ionicons
                name={rating !== null && value <= rating ? 'star' : 'star-outline'}
                size={40}
                color={rating !== null && value <= rating ? colors.accent : colors.starEmpty}
              />
            </Pressable>
          ))}
        </View>
        {validationError !== null && <Text style={styles.error}>{validationError}</Text>}
      </View>

      {boards.length > 0 && (
        <>
          <Text style={styles.label}>{t.sessions.board}</Text>
          <View style={styles.chips}>
            <Chip
              label={t.sessions.boardNone}
              selected={boardId === null}
              onPress={() => setBoardId(null)}
            />
            {boards.map((board) => (
              <Chip
                key={board.id}
                label={board.name}
                selected={boardId === board.id}
                onPress={() => setBoardId(board.id)}
              />
            ))}
          </View>
        </>
      )}

      <Text style={styles.label}>{t.sessions.duration}</Text>
      <View style={styles.chips}>
        {DURATIONS.map((min) => (
          <Chip
            key={min}
            label={String(min)}
            selected={duration === min}
            // Toggle deliberado (sem chip "—"): limpar duração é corrigir um
            // toque acidental, sem peso semântico — ruído a menos no ecrã.
            onPress={() => setDuration(duration === min ? null : min)}
          />
        ))}
      </View>

      <Text style={styles.label}>{t.sessions.notes}</Text>
      <TextInput
        style={[styles.input, styles.notes]}
        value={notes}
        onChangeText={setNotes}
        placeholder={t.sessions.notesPlaceholder}
        placeholderTextColor={colors.inkMuted}
        multiline
      />

      {externalError != null && <Text style={styles.error}>{externalError}</Text>}
      <Pressable style={styles.submitButton} onPress={submit}>
        <Text style={styles.submitButtonLabel}>{submitLabel}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.md, gap: space.sm, backgroundColor: colors.background },
  label: {
    fontFamily: font.bodySemiBold,
    fontSize: 13,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: space.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.chip,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipLabel: { fontFamily: font.body, fontSize: 14, color: colors.ink },
  chipLabelSelected: { fontFamily: font.bodySemiBold, color: colors.accentOn },
  whenPreview: { fontFamily: font.mono, color: colors.inkMuted, fontSize: 13 },
  stars: { flexDirection: 'row', gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: font.body,
    fontSize: 16,
    color: colors.ink,
  },
  notes: { minHeight: 80, textAlignVertical: 'top', fontStyle: 'italic' },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.input,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: space.sm,
  },
  submitButtonLabel: { fontFamily: font.bodySemiBold, fontSize: 16, color: colors.accentOn },
  error: { fontFamily: font.body, color: colors.error },
});
```

Nota: `externalError != null` (loose) cobre `null | undefined` deliberadamente, porque a prop é opcional.

- [ ] **Step 2: Reescrever sessao/nova.tsx como wrapper**

Substituir o conteúdo de `src/app/sessao/nova.tsx` por:

```tsx
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SessionForm } from '../../components/SessionForm';
import { t } from '../../i18n';
import { runPendingQueue } from '../../services/openmeteo/runner';
import { useBoardsStore } from '../../stores/boardsStore';
import { useSessionsStore } from '../../stores/sessionsStore';
import { useSpotsStore } from '../../stores/spotsStore';
import { colors, font, radius, space } from '../../theme';

export default function NewSessionScreen() {
  const spots = useSpotsStore((s) => s.spots);
  const loadSpots = useSpotsStore((s) => s.load);
  const boards = useBoardsStore((s) => s.boards);
  const loadBoards = useBoardsStore((s) => s.load);
  const createSession = useSessionsStore((s) => s.create);
  const storeError = useSessionsStore((s) => s.error);
  const lastUsedSpotId = useSessionsStore((s) => s.lastUsedSpotId);
  const loadLastUsedSpot = useSessionsStore((s) => s.loadLastUsedSpot);

  useEffect(() => {
    void loadSpots();
    void loadBoards();
    void loadLastUsedSpot();
  }, [loadSpots, loadBoards, loadLastUsedSpot]);

  if (spots.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.empty}>{t.sessions.noSpots}</Text>
        <Pressable style={styles.registerButton} onPress={() => router.push('/spot/novo')}>
          <Text style={styles.registerButtonLabel}>{t.spots.create}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SessionForm
      spots={spots}
      boards={boards}
      defaultSpotId={lastUsedSpotId}
      submitLabel={t.sessions.register}
      externalError={storeError}
      onSubmit={async (values) => {
        const session = await createSession({
          spotId: values.spotId,
          boardId: values.boardId ?? undefined,
          startedAt: values.startedAt,
          rating: values.rating,
          durationMin: values.durationMin ?? undefined,
          notes: values.notes ?? undefined,
        });
        if (session !== null) {
          // Trigger 4 (extensão ao §6 aprovada): registar É o momento em que o
          // utilizador quer as condições; a guarda singleFlight torna-o seguro.
          runPendingQueue().catch((e) => console.warn('[worker] trigger pós-create:', e));
          router.back();
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    padding: space.lg,
    backgroundColor: colors.background,
  },
  empty: { textAlign: 'center', fontFamily: font.body, color: colors.inkMuted },
  registerButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.input,
    paddingVertical: 14,
    paddingHorizontal: space.xl,
    alignItems: 'center',
  },
  registerButtonLabel: { fontFamily: font.bodySemiBold, fontSize: 16, color: colors.accentOn },
});
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit` — Expected: sem erros.
Run: `npm test` — Expected: verde.
Smoke manual (dispositivo/emulador, se disponível nesta sessão; senão fica para o DoD): abrir "Nova sessão", confirmar pré-seleção do último spot, registar uma sessão em <30s.

- [ ] **Step 4: Commit**

```bash
git add src/components/SessionForm.tsx src/app/sessao/nova.tsx
git commit -m "refactor: extrair SessionForm de sessao/nova (padrao SpotForm/BoardForm)"
```

---

### Task 6: Ecrã Editar sessão + rota + entrada no detalhe (peça C, ecrã)

**Files:**
- Create: `src/app/sessao/editar/[id].tsx`
- Modify: `src/app/_layout.tsx`
- Modify: `src/app/sessao/[id].tsx`
- Modify: `src/i18n/index.ts`

**Interfaces:**
- Consumes: `SessionForm`/`SessionFormValues` (Task 5); `sessionsStore.update` (Task 4); `t.sessions.editTitle` (novo, este task).
- Produces: rota `/sessao/editar/[id]`.

- [ ] **Step 1: i18n**

Em `src/i18n/index.ts`, dentro de `sessions`, a seguir a `detailTitle: 'Sessão',`:

```ts
    editTitle: 'Editar sessão',
```

- [ ] **Step 2: Registar a rota**

Em `src/app/_layout.tsx`, a seguir à linha do `sessao/[id]`:

```tsx
      <Stack.Screen name="sessao/editar/[id]" options={{ title: t.sessions.editTitle }} />
```

- [ ] **Step 3: Criar src/app/sessao/editar/[id].tsx**

```tsx
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { SessionForm } from '../../../components/SessionForm';
import { t } from '../../../i18n';
import { runPendingQueue } from '../../../services/openmeteo/runner';
import { useBoardsStore } from '../../../stores/boardsStore';
import { useSessionsStore } from '../../../stores/sessionsStore';
import { useSpotsStore } from '../../../stores/spotsStore';

export default function EditSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSessionsStore((s) => s.sessions.find((x) => x.id === id));
  const updateSession = useSessionsStore((s) => s.update);
  const storeError = useSessionsStore((s) => s.error);
  const spots = useSpotsStore((s) => s.spots);
  const loadSpots = useSpotsStore((s) => s.load);
  const boards = useBoardsStore((s) => s.boards);
  const loadBoards = useBoardsStore((s) => s.load);

  useEffect(() => {
    void loadSpots();
    void loadBoards();
  }, [loadSpots, loadBoards]);

  // Só alcançável a partir do detalhe, que lê da lista carregada.
  if (session === undefined) {
    return null;
  }

  return (
    <SessionForm
      spots={spots}
      boards={boards}
      initial={{
        spotId: session.spotId,
        startedAt: session.startedAt,
        rating: session.rating,
        boardId: session.boardId,
        durationMin: session.durationMin,
        notes: session.notes,
      }}
      submitLabel={t.common.save}
      externalError={storeError}
      onSubmit={async (values) => {
        // null-clear deliberado (semântica SessionChanges): o formulário edita
        // todos os campos, por isso null aqui significa "limpo pelo utilizador".
        const updated = await updateSession(session.id, {
          spotId: values.spotId,
          startedAt: values.startedAt,
          rating: values.rating,
          boardId: values.boardId,
          durationMin: values.durationMin,
          notes: values.notes,
        });
        if (updated !== null) {
          // Espelho do trigger 4 de nova.tsx: se o update invalidou condições
          // (Regra 3, decidida no repo), o worker refaz o fetch já — a guarda
          // singleFlight torna a chamada segura mesmo sem invalidação.
          runPendingQueue().catch((e) => console.warn('[worker] trigger pós-edit:', e));
          router.back();
        }
      }}
    />
  );
}
```

- [ ] **Step 4: Entrada no detalhe + refetch de condições em foco**

Em `src/app/sessao/[id].tsx`:

1. Trocar imports do expo-router e react:

```tsx
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
```

2. Substituir o `useEffect` das condições (o detalhe volta a estar em foco depois de editar; com invalidação, o refetch mostra "a obter…" em vez de condições velhas):

```tsx
  useFocusEffect(
    useCallback(() => {
      if (id !== undefined) {
        void getConditions(id).then(setConditions);
      }
    }, [id, getConditions]),
  );
```

3. Dentro do JSX, como primeiro filho do `ScrollView`, o botão Editar no header:

```tsx
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push(`/sessao/editar/${session.id}`)} hitSlop={8}>
              <Ionicons name="create-outline" size={22} color={colors.ink} />
            </Pressable>
          ),
        }}
      />
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit` — Expected: sem erros.
Run: `npm test` — Expected: verde.
Smoke manual (dispositivo/emulador, se disponível; senão fica para o DoD): detalhe → lápis → editar rating → guardar → detalhe reflete; editar hora → detalhe mostra "Condições a obter…" e o worker preenche com rede.

- [ ] **Step 6: Commit**

```bash
git add "src/app/sessao/editar/[id].tsx" src/app/_layout.tsx "src/app/sessao/[id].tsx" src/i18n/index.ts
git commit -m "feat: ecra Editar sessao com entrada no detalhe e refetch em foco"
```

---

## Notas de comportamento assumidas (não são gaps)

- **Spot/prancha arquivados numa sessão editada:** as listas só têm ativos; o chip do item arquivado não aparece, mas o valor guardado preserva-se se o utilizador não tocar nesse campo. Aceitável no MVP.
- **Sessão surfada há >92 dias:** o picker continua limitado a 92 dias (teto da Open-Meteo); os chips de offset funcionam na mesma. Comportamento herdado de `nova.tsx`, sem mudança.
- **`crowd`:** existe em `SessionChanges` (paridade com `NewSession`) mas o formulário não o expõe — tal como não o expõe no registo.
- **BACKLOG.md:** esta tarefa não é uma tarefa numerada do backlog (é fecho de dívida do passe de design); nada a marcar lá.
