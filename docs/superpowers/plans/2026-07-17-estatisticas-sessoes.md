# Estatísticas de sessões — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O topo da lista de sessões mostra streak, recorde e spot mais surfado — números reais, calculados sobre o histórico todo — e um cartão ganha um badge "+N%" quando o swell da sessão bate a média do spot.

**Architecture:** Uma query nova de agregação no `sessionRepo` devolve **factos crus** (datas, recorde, contagens) sobre a tabela toda, imune ao LIMIT 50 da lista. O streak e a percentagem do badge são funções puras em `src/services/stats/`, testadas isoladamente. Uma `statsStore` pequena liga as duas pontas; a UI é `ListHeaderComponent` + um pill no cartão.

**Tech Stack:** React Native 0.86 + Expo SDK 57 (expo-sqlite, Zustand), TypeScript strict, Jest + better-sqlite3. **Zero deps novas, zero migrations.**

**Spec:** `docs/superpowers/specs/2026-07-17-estatisticas-sessoes-design.md`

## Global Constraints

- Strings de UI em pt-PT via `src/i18n` — nunca hardcoded (CLAUDE.md).
- Identificadores em inglês; comentários de código em pt-PT (padrão do projeto).
- **Repositories são a única camada que toca SQL** (CLAUDE.md). Stores e ecrãs nunca escrevem SQL.
- Datas na BD em epoch seconds UTC; conversão para local só na apresentação. **O streak agrupa em hora LOCAL** — a semana do surfista é a do relógio dele.
- Zero cores/fontes hardcoded — tudo de `Theme` via `useTheme()`; `space`/`radius` importados.
- **Zero deps novas, zero migrations.** Se parecer preciso, PARAR e reportar.
- **Gate de tipos: `npx tsc --noEmit`.** O Jest é jest-expo → babel-jest e NÃO type-checka.
- Testes obrigatórios para a lógica nova (`weekStreak`, `swellVsAverage`, `getStats`); UI sem testes (MVP, CLAUDE.md regra 4).
- Commits: conventional commits com trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

### Regras de dados vinculativas (clarificações do Bruno — a distinção é o ponto)

- `record` **filtra `fetch_status='ok'`** — o swell tem de existir para ser recorde.
- `sessionsBySpot` **NÃO filtra** — "o spot que mais surfas" não depende de a API ter respondido.
- `startedAtAll` **NÃO filtra** — surfaste nessa semana, com ou sem condições obtidas.
- Badge: **≥10** sessões `ok` no spot (fronteira fechada por teste: 9 → sem badge, 10 → com badge).

## Estrutura de ficheiros

| Ficheiro | Responsabilidade | Tarefa |
|---|---|---|
| `src/db/types.ts` | `SessionStatsRaw` | 1 |
| `src/db/repositories/sessionRepo.ts` | `getStats()` — 3 SELECT sequenciais | 1 |
| `src/db/__tests__/sessionRepo.test.ts` | teste da query | 1 |
| `src/services/stats/streak.ts` | `weekStreak` (função pura) | 2 |
| `src/services/stats/badge.ts` | `swellVsAverage` (função pura) | 3 |
| `src/services/stats/__tests__/` | testes das duas | 2, 3 |
| `src/stores/statsStore.ts` | estado | 4 |
| `src/app/(tabs)/index.tsx` | tiles + badge | 4 |
| `src/i18n/index.ts` | textos | 4 |

---

### Task 1: `getStats()` no repo (TDD)

**Files:**
- Modify: `src/db/types.ts`
- Modify: `src/db/repositories/sessionRepo.ts`
- Test: `src/db/__tests__/sessionRepo.test.ts` (existe — acrescentar, não recriar)

**Interfaces:**
- Consumes: `SqlDb` (`getAllAsync`, `getFirstAsync`), o schema de `001_initial.ts`.
- Produces (as Tasks 2-4 dependem, verbatim):
```ts
export interface SessionStatsRaw {
  startedAtAll: number[];
  record: { swellHeightM: number; spotName: string } | null;
  sessionsBySpot: { spotName: string; count: number }[];
}
// em SessionRepository:
getStats(): Promise<SessionStatsRaw>;
```

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar a `src/db/__tests__/sessionRepo.test.ts`, dentro do `describe('sessionRepo')` existente, a seguir ao último teste:

```ts
  test('(l) getStats agrega sobre a tabela TODA e respeita os filtros de fetch_status', async () => {
    // spot-1: 2 sessões (1 ok, 1 pending) · spot-2: 1 sessão (ok, swell maior)
    const s1 = await repo.create({ spotId: 'spot-1', startedAt: 1_000, rating: 4 });
    const s2 = await repo.create({ spotId: 'spot-1', startedAt: 2_000, rating: 4 });
    const s3 = await repo.create({ spotId: 'spot-2', startedAt: 3_000, rating: 5 });
    raw.prepare("UPDATE session_conditions SET fetch_status='ok', swell_height_m=0.9 WHERE session_id=?").run(s1.id);
    raw.prepare("UPDATE session_conditions SET fetch_status='ok', swell_height_m=2.1 WHERE session_id=?").run(s3.id);
    // s2 fica pending com swell NULL

    const stats = await repo.getStats();

    // startedAtAll: TODAS as sessões (sem filtro de fetch_status), desc.
    expect(stats.startedAtAll).toEqual([3_000, 2_000, 1_000]);

    // record: só entre as ok — o maior swell, com o spot dele.
    expect(stats.record).toEqual({ swellHeightM: 2.1, spotName: 'Ericeira' });

    // sessionsBySpot: TODAS as sessões (a pending de spot-1 conta), desc.
    expect(stats.sessionsBySpot).toEqual([
      { spotName: 'Carcavelos', count: 2 },
      { spotName: 'Ericeira', count: 1 },
    ]);
  });

  test('(m) getStats sem sessões: arrays vazios e record null (nunca zeros fabricados)', async () => {
    const stats = await repo.getStats();
    expect(stats.startedAtAll).toEqual([]);
    expect(stats.record).toBeNull();
    expect(stats.sessionsBySpot).toEqual([]);
  });

  test('(n) getStats: record é null se NENHUMA sessão tem condições ok, mas as contagens contam-nas na mesma', async () => {
    await repo.create({ spotId: 'spot-1', startedAt: 1_000, rating: 4 }); // fica pending
    const stats = await repo.getStats();

    expect(stats.record).toBeNull(); // sem ok não há recorde
    expect(stats.startedAtAll).toEqual([1_000]); // mas a sessão existiu
    expect(stats.sessionsBySpot).toEqual([{ spotName: 'Carcavelos', count: 1 }]);
  });
```

- [ ] **Step 2: Correr o teste e vê-lo falhar**

Run: `npm test -- sessionRepo`
Expected: FAIL — `TypeError: repo.getStats is not a function`. (O babel-jest não type-checka: a falha é em runtime.)

- [ ] **Step 3: Implementar**

Em `src/db/types.ts`, a seguir a `SessionListItem`:

```ts
// Factos crus para as estatísticas — o repo agrega, não conclui. O streak
// deriva-se de startedAtAll em TS (src/services/stats/streak.ts): "semanas
// consecutivas" em SQLite exigiria strftime + window functions, ilegível e
// só testável com BD.
export interface SessionStatsRaw {
  /** started_at (epoch s, UTC) de TODAS as sessões, desc. */
  startedAtAll: number[];
  /** Maior swell entre sessões com condições ok, e o spot dela. */
  record: { swellHeightM: number; spotName: string } | null;
  /** Contagem por spot, desc. */
  sessionsBySpot: { spotName: string; count: number }[];
}
```

Em `src/db/repositories/sessionRepo.ts`:

1. Acrescentar `type SessionStatsRaw` ao import de `../types`.
2. Na interface `SessionRepository`, a seguir a `listWithDetails`:

```ts
  /**
   * Factos crus para as estatísticas, sobre a tabela TODA — deliberadamente
   * imune ao LIMIT da lista: um recorde que desaparecesse à 51ª sessão seria
   * um bug silencioso.
   */
  getStats(): Promise<SessionStatsRaw>;
```

3. Na implementação, a seguir a `listWithDetails`:

```ts
    async getStats(): Promise<SessionStatsRaw> {
      // Três SELECT SEQUENCIAIS, não Promise.all: o SqlDb é uma ligação
      // SQLite única (não um pool), por isso paralelizar não paraleliza nada
      // — serializa na mesma ligação e troca ordem determinística por
      // arbitragem do expo-sqlite, a troco de zero. Sequencial também dá uma
      // leitura mais coerente (sem intercalar com escritas do worker).
      const dates = await db.getAllAsync<{ started_at: number }>(
        'SELECT started_at FROM sessions ORDER BY started_at DESC',
        [],
      );

      // Só as ok: o swell tem de existir para ser recorde.
      const record = await db.getFirstAsync<{ swell_height_m: number; spot_name: string }>(
        `SELECT c.swell_height_m, sp.name AS spot_name
         FROM session_conditions c
         JOIN sessions s ON s.id = c.session_id
         JOIN spots sp ON sp.id = s.spot_id
         WHERE c.fetch_status = 'ok' AND c.swell_height_m IS NOT NULL
         ORDER BY c.swell_height_m DESC
         LIMIT 1`,
        [],
      );

      // SEM filtro de fetch_status: "o spot que mais surfas" não depende de a
      // API ter respondido. Sem filtro de is_archived: um spot arquivado foi
      // surfado na mesma (mesma razão do histórico, docs/DATABASE.md §Regras 4).
      const bySpot = await db.getAllAsync<{ spot_name: string; n: number }>(
        `SELECT sp.name AS spot_name, COUNT(*) AS n
         FROM sessions s
         JOIN spots sp ON sp.id = s.spot_id
         GROUP BY s.spot_id, sp.name
         ORDER BY n DESC, sp.name ASC`,
        [],
      );

      return {
        startedAtAll: dates.map((d) => d.started_at),
        record:
          record === null
            ? null
            : { swellHeightM: record.swell_height_m, spotName: record.spot_name },
        sessionsBySpot: bySpot.map((b) => ({ spotName: b.spot_name, count: b.n })),
      };
    },
```

Nota: `ORDER BY n DESC, sp.name ASC` — o desempate alfabético torna a ordem determinística com contagens iguais (senão o SQLite escolhe, e o teste fica flaky).

- [ ] **Step 4: Correr os testes e vê-los passar**

Run: `npm test -- sessionRepo`
Expected: PASS — 3 testes novos (l, m, n) + os existentes.

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 5: Commit**

```bash
git add src/db/types.ts src/db/repositories/sessionRepo.ts src/db/__tests__/sessionRepo.test.ts
git commit -m "feat: getStats no sessionRepo com factos crus sobre a tabela toda

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `weekStreak` (TDD)

**Files:**
- Create: `src/services/stats/streak.ts`
- Create: `src/services/stats/__tests__/streak.test.ts`

**Interfaces:**
- Consumes: `startedAtAll: number[]` (Task 1).
- Produces: `export function weekStreak(startedAtAll: number[], now: Date): number;`

`now` é injetado (não `new Date()` dentro) — é o que torna a função testável com datas fixas, como o `deps.now()` dos repos.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/services/stats/__tests__/streak.test.ts`:

```ts
import { weekStreak } from '../streak';

// Epochs REAIS em hora local de Portugal (a semana do surfista é a do relógio
// dele), verificados com `TZ=Europe/Lisbon node -e "..."`. Segundas-feiras de
// referência, todas às 10:00 locais.
const SEG_13JUL = 1_783_933_200;
const SEG_06JUL = 1_783_328_400;
const SEG_29JUN = 1_782_723_600;
const SEG_22JUN = 1_782_118_800;

// Quinta 16/07/2026, 10:00 local — dentro da semana de 13/07.
const QUI_16JUL = new Date(1_784_192_400 * 1000);

describe('weekStreak', () => {
  test('sem sessões → 0', () => {
    expect(weekStreak([], QUI_16JUL)).toBe(0);
  });

  test('conta semanas consecutivas até à semana atual', () => {
    expect(weekStreak([SEG_13JUL, SEG_06JUL, SEG_29JUN], QUI_16JUL)).toBe(3);
  });

  test('para no primeiro buraco (a semana de 06/07 falta)', () => {
    expect(weekStreak([SEG_13JUL, SEG_29JUN], QUI_16JUL)).toBe(1);
  });

  test('várias sessões na mesma semana contam uma vez', () => {
    expect(weekStreak([SEG_13JUL, SEG_13JUL + 86_400, SEG_06JUL], QUI_16JUL)).toBe(2);
  });

  test('a semana ATUAL sem sessões não parte a streak (ainda não acabou)', () => {
    // Segunda de manhã, sem surfar esta semana: a streak das 2 anteriores mantém-se.
    expect(weekStreak([SEG_06JUL, SEG_29JUN], QUI_16JUL)).toBe(2);
  });

  test('a semana ANTERIOR sem sessões parte a streak (essa já acabou)', () => {
    // Última sessão há 2+ semanas: a semana de 06/07 passou em branco.
    expect(weekStreak([SEG_29JUN, SEG_22JUN], QUI_16JUL)).toBe(0);
  });
});
```

- [ ] **Step 2: Correr o teste e vê-lo falhar**

Run: `npm test -- streak`
Expected: FAIL — `Cannot find module '../streak'`.

- [ ] **Step 3: Implementar**

Criar `src/services/stats/streak.ts`:

```ts
// Semanas consecutivas com pelo menos uma sessão, até hoje.
//
// A semana é ISO (segunda a domingo) e em hora LOCAL — a semana do surfista é
// a do relógio dele, não UTC. (O resto da app guarda tudo em UTC; aqui a
// conversão é deliberada e é da camada de apresentação, que é o que isto é.)
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Segunda-feira 00:00 local da semana que contém `d`. É a chave de agrupamento.
function mondayOf(d: Date): number {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayOfWeek = (m.getDay() + 6) % 7; // getDay: 0=domingo → 0=segunda
  m.setDate(m.getDate() - dayOfWeek);
  return m.getTime();
}

export function weekStreak(startedAtAll: number[], now: Date): number {
  if (startedAtAll.length === 0) {
    return 0;
  }

  const weeks = new Set(startedAtAll.map((s) => mondayOf(new Date(s * 1000))));
  const currentWeek = mondayOf(now);

  // A semana atual NÃO conta como buraco enquanto não acabar: sem isto, uma
  // streak de 8 semanas mostrava 0 à segunda de manhã — falso e desmoralizante.
  // Começamos na semana atual se houve sessão, senão na anterior.
  let cursor = weeks.has(currentWeek) ? currentWeek : currentWeek - WEEK_MS;

  let streak = 0;
  while (weeks.has(cursor)) {
    streak += 1;
    cursor -= WEEK_MS;
  }
  return streak;
}
```

**Atenção ao `cursor -= WEEK_MS` — isto é provavelmente um bug:** a semana de 23/03/2026 tem **167 horas reais**, não 168 (medido: `1774861200 − 1774260000 = 601200s = 167h`, a mudança para WEST), e a de 19/10 tem 169. Como `mondayOf` normaliza para 00:00 local, subtrair 7×24h cegamente aterra às 23:00 do domingo — outra chave, streak partida. **O Step 5 prova se acontece e traz a correção.**

- [ ] **Step 4: Correr o teste e vê-lo passar — e testar a fronteira WET/WEST**

Run: `npm test -- streak`
Expected: PASS, 6 testes.

Acrescentar ao ficheiro de teste o caso da mudança de hora (a app já usou estes epochs reais nos testes do matcher):

```ts
  // Epochs REAIS (TZ=Europe/Lisbon), com a mudança de hora no meio:
  //   23/03 10:00 → 1774260000 · 30/03 10:00 → 1774861200 (167h de intervalo!)
  //   19/10 10:00 → 1792400400 · 26/10 10:00 → 1793008800 (169h)
  // Se a aritmética de semanas usar 7*24h cegamente, a chave desalinha-se aqui.
  test('a mudança WET/WEST não parte a streak', () => {
    const QUI_02ABR = new Date(1_775_120_400 * 1000);
    expect(weekStreak([1_774_861_200, 1_774_260_000], QUI_02ABR)).toBe(2);

    const QUI_29OUT = new Date(1_793_268_000 * 1000);
    expect(weekStreak([1_793_008_800, 1_792_400_400], QUI_29OUT)).toBe(2);
  });
```

Run: `npm test -- streak`

**Se este teste FALHAR, é o bug que o comentário do Step 3 previu** — não é um teste mal escrito, é a função errada. Correção: andar para trás por **calendário**, não por milissegundos. Substituir `cursor -= WEEK_MS` por:

```ts
function previousMonday(mondayMs: number): number {
  const d = new Date(mondayMs);
  d.setDate(d.getDate() - 7); // setDate respeita a mudança de hora; 7*24h não
  return d.getTime();
}
```
e no laço: `cursor = previousMonday(cursor);`. O `WEEK_MS` deixa de ser usado no laço — se ficar sem uso nenhum, **apagar** (nada de constantes órfãs). A escolha inicial no `cursor` (`currentWeek - WEEK_MS`) também passa a `previousMonday(currentWeek)`.

**Reportar no relatório se o teste falhou e a correção foi aplicada** — é informação de valor sobre a base de código, não uma falha.

Expected (depois da correção, se necessária): PASS, 7 testes.

- [ ] **Step 5: Commit**

```bash
git add src/services/stats/streak.ts src/services/stats/__tests__/streak.test.ts
git commit -m "feat: weekStreak com semanas locais e semana atual sem partir a streak

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `swellVsAverage` (TDD)

**Files:**
- Create: `src/services/stats/badge.ts`
- Create: `src/services/stats/__tests__/badge.test.ts`

**Interfaces:**
- Consumes: `SessionListItem` de `src/db/types.ts`.
- Produces: `export function swellVsAverage(session: SessionListItem, spotSessions: SessionListItem[]): number | null;`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/services/stats/__tests__/badge.test.ts`:

```ts
import { type SessionListItem } from '../../../db/types';
import { swellVsAverage } from '../badge';

// Fábrica mínima: só os campos que o cálculo lê.
function session(id: string, swellHeightM: number | null, ok = true): SessionListItem {
  return {
    id,
    spotId: 'spot-1',
    boardId: null,
    startedAt: 1_000,
    durationMin: null,
    rating: 4,
    crowd: null,
    notes: null,
    createdAt: 1,
    updatedAt: 1,
    spotName: 'Carcavelos',
    boardName: null,
    swellHeightM,
    swellPeriodS: null,
    windSpeedKmh: null,
    windDirectionDeg: null,
    tidePhase: null,
    fetchStatus: ok ? 'ok' : 'pending',
  };
}

// 10 sessões ok de 1.0 m: média das OUTRAS = 1.0 exatamente.
const tenAtOne = Array.from({ length: 10 }, (_, i) => session(`s${i}`, 1.0));

describe('swellVsAverage', () => {
  test('fronteira: 9 sessões ok no spot → sem badge', () => {
    const nine = tenAtOne.slice(0, 9);
    const s = session('alvo', 2.0);
    expect(swellVsAverage(s, [...nine, s])).toBeNull(); // 9 outras + a própria
  });

  test('fronteira: 10 sessões ok no spot → com badge', () => {
    const s = session('alvo', 2.0);
    // 10 outras a 1.0 + a própria a 2.0 → +100%
    expect(swellVsAverage(s, [...tenAtOne, s])).toBe(100);
  });

  test('a própria sessão não entra na média', () => {
    // Se entrasse, a média seria (10*1.0 + 3.0)/11 = 1.18 → +154%.
    // Excluída: média = 1.0 → +200%.
    const s = session('alvo', 3.0);
    expect(swellVsAverage(s, [...tenAtOne, s])).toBe(200);
  });

  test('swell abaixo da média → null (o badge só celebra)', () => {
    const s = session('alvo', 0.5);
    expect(swellVsAverage(s, [...tenAtOne, s])).toBeNull();
  });

  test('swell igual à média → null (0% não é notícia)', () => {
    const s = session('alvo', 1.0);
    expect(swellVsAverage(s, [...tenAtOne, s])).toBeNull();
  });

  test('sessões pending/failed não contam para a amostra nem para a média', () => {
    const s = session('alvo', 2.0);
    // 9 ok + 5 pending: a amostra ok é 9 → sem badge, apesar de 14 sessões.
    const pendings = Array.from({ length: 5 }, (_, i) => session(`p${i}`, null, false));
    expect(swellVsAverage(s, [...tenAtOne.slice(0, 9), ...pendings, s])).toBeNull();
  });

  test('sessão sem swell (ou não-ok) não tem badge', () => {
    const semSwell = session('alvo', null);
    expect(swellVsAverage(semSwell, [...tenAtOne, semSwell])).toBeNull();

    const pending = session('alvo', 2.0, false);
    expect(swellVsAverage(pending, [...tenAtOne, pending])).toBeNull();
  });

  test('arredonda ao inteiro', () => {
    const s = session('alvo', 1.7); // +70%
    expect(swellVsAverage(s, [...tenAtOne, s])).toBe(70);
  });
});
```

- [ ] **Step 2: Correr o teste e vê-lo falhar**

Run: `npm test -- badge`
Expected: FAIL — `Cannot find module '../badge'`.

- [ ] **Step 3: Implementar**

Criar `src/services/stats/badge.ts`:

```ts
import { type SessionListItem } from '../../db/types';

// Amostra mínima para uma média significar alguma coisa. Com menos, o badge
// não aparece — comparar-se com 3 sessões é ruído, não sinal.
const MIN_SAMPLE = 10;

/**
 * Quanto o swell desta sessão bate a média das OUTRAS sessões do mesmo spot,
 * em % inteira. null quando não há badge a mostrar: amostra < 10 ok, sessão
 * sem swell ok, ou percentagem não-positiva (o badge só celebra).
 */
export function swellVsAverage(
  session: SessionListItem,
  spotSessions: SessionListItem[],
): number | null {
  if (session.fetchStatus !== 'ok' || session.swellHeightM === null) {
    return null;
  }

  // A própria sessão sai da média: senão comparava-se consigo mesma e
  // qualquer sessão puxaria a média na sua própria direção.
  const others = spotSessions.filter(
    (s) => s.id !== session.id && s.fetchStatus === 'ok' && s.swellHeightM !== null,
  );
  if (others.length < MIN_SAMPLE) {
    return null;
  }

  const avg = others.reduce((sum, s) => sum + (s.swellHeightM ?? 0), 0) / others.length;
  if (avg <= 0) {
    return null; // média zero: divisão sem significado
  }

  const pct = Math.round(((session.swellHeightM - avg) / avg) * 100);
  return pct > 0 ? pct : null;
}
```

- [ ] **Step 4: Correr o teste e vê-lo passar**

Run: `npm test -- badge`
Expected: PASS, 8 testes.

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 5: Commit**

```bash
git add src/services/stats/badge.ts src/services/stats/__tests__/badge.test.ts
git commit -m "feat: swellVsAverage com amostra minima de 10 e exclusao da propria sessao

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Store + UI (tiles e badge)

**Files:**
- Create: `src/stores/statsStore.ts`
- Modify: `src/i18n/index.ts`
- Modify: `src/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `getStats()` (Task 1), `weekStreak` (Task 2), `swellVsAverage` (Task 3), `useTheme()`/`Theme`.
- Produces: nada.

Sem testes (UI + store fina sobre repo já testado, padrão do projeto).

- [ ] **Step 1: Criar a store**

Criar `src/stores/statsStore.ts`:

```ts
import { create } from 'zustand';

import { getSessionRepo } from '../db';
import { type SessionStatsRaw } from '../db/types';

// Padrão das outras stores: repo por ação, try/catch. SEM `error` visível:
// falhar as estatísticas não é um erro que o utilizador precise de ver — os
// tiles somem e o histórico funciona na mesma (nunca bloquear a lista por
// causa de um número decorativo).
interface StatsState {
  stats: SessionStatsRaw | null;
  load(): Promise<void>;
}

export const useStatsStore = create<StatsState>()((set) => ({
  stats: null,

  async load() {
    try {
      const repo = await getSessionRepo();
      set({ stats: await repo.getStats() });
    } catch (e) {
      console.warn('[stats] load:', e);
      set({ stats: null });
    }
  },
}));
```

- [ ] **Step 2: i18n**

Em `src/i18n/index.ts`, dentro do bloco `sessions`, a seguir a `emptyBody`:

```ts
    stats: {
      weeks: (n: number) => (n === 1 ? '1 semana' : `${n} semanas`),
      record: 'Recorde',
      mostSurfed: 'Mais surfado',
      streak: 'Seguidas',
      sessionsCount: (n: number) => (n === 1 ? '1 sessão' : `${n} sessões`),
    },
```

- [ ] **Step 3: Tiles no cabeçalho da lista**

Em `src/app/(tabs)/index.tsx`:

1. Imports novos:
```tsx
import { useStatsStore } from '../../stores/statsStore';
import { weekStreak } from '../../services/stats/streak';
import { swellVsAverage } from '../../services/stats/badge';
```

2. Componente novo, a seguir a `Stars` (fora do ecrã):

```tsx
function StatTile({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

// Cada tile só existe se tiver dado real: zero placeholders, zero "—". Sem
// nada que mostrar, a barra inteira não renderiza.
function StatsBar() {
  const stats = useStatsStore((s) => s.stats);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  if (stats === null) {
    return null;
  }

  const streak = weekStreak(stats.startedAtAll, new Date());
  const top = stats.sessionsBySpot[0] ?? null;
  const tiles = [
    streak > 0 ? { label: t.sessions.stats.streak, value: t.sessions.stats.weeks(streak) } : null,
    stats.record !== null
      ? { label: t.sessions.stats.record, value: `${stats.record.swellHeightM} m · ${stats.record.spotName}` }
      : null,
    top !== null
      ? { label: t.sessions.stats.mostSurfed, value: `${top.spotName} · ${top.count}` }
      : null,
  ].filter((tile) => tile !== null);

  if (tiles.length === 0) {
    return null;
  }
  return (
    <View style={styles.statsBar}>
      {tiles.map((tile) => (
        <StatTile key={tile.label} label={tile.label} value={tile.value} />
      ))}
    </View>
  );
}
```

3. No `SessionsScreen`, a seguir aos hooks existentes:
```tsx
  const loadStats = useStatsStore((s) => s.load);
```
E dentro do `useFocusEffect` existente, a seguir ao `void load();`:
```tsx
      void loadStats();
```
(Recarrega com a lista: uma sessão nova muda os números.)

4. No `FlatList`, a seguir ao `refreshControl`:
```tsx
        ListHeaderComponent={sessions.length > 0 ? <StatsBar /> : null}
```
(`ListHeaderComponent`, não um `View` acima do FlatList: assim faz scroll com o conteúdo. Com a lista vazia não há barra — o empty state já manda a mensagem.)

5. Estilos novos em `makeStyles`:
```tsx
    statsBar: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm },
    tile: {
      flex: 1,
      padding: space.sm,
      backgroundColor: theme.colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      gap: space.xs2,
    },
    tileValue: { fontFamily: theme.font.monoMedium, fontSize: 15, color: theme.colors.ink },
    tileLabel: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.inkMuted, textTransform: 'uppercase' },
```

- [ ] **Step 4: Badge no cartão**

Ainda em `src/app/(tabs)/index.tsx`:

1. O `SessionCard` precisa das outras sessões do mesmo spot para a média. A filtragem por spot faz-se no `renderItem` — assim a função pura recebe só o que lhe interessa e não precisa de saber de que spot se trata.

No `renderItem` do FlatList:
```tsx
        renderItem={({ item }) => (
          <SessionCard
            item={item}
            spotSessions={sessions.filter((s) => s.spotId === item.spotId)}
            onRetry={(id) => void retryConditions(id)}
          />
        )}
```

2. Na assinatura do `SessionCard`:
```tsx
function SessionCard({
  item,
  spotSessions,
  onRetry,
}: {
  item: SessionListItem;
  spotSessions: SessionListItem[];
  onRetry(id: string): void;
}) {
```

3. Dentro do `SessionCard`, a seguir ao `const meta = ...`:
```tsx
  const pct = swellVsAverage(item, spotSessions);
```

4. Na `ConditionsZone`, o badge precisa do `pct` — passa-se por prop. Na chamada dentro do `SessionCard`:
```tsx
      <ConditionsZone item={item} pct={pct} onRetry={onRetry} />
```
E na assinatura da `ConditionsZone`:
```tsx
function ConditionsZone({
  item,
  pct,
  onRetry,
}: {
  item: SessionListItem;
  pct: number | null;
  onRetry(id: string): void;
}) {
```

5. No ramo `ok` da `ConditionsZone`, envolver a linha do sinal:
```tsx
      {hasSignal && (
        <View style={styles.signalRow}>
          <Text style={styles.condSignal}>
            {item.swellHeightM !== null ? `${item.swellHeightM} m` : DASH}
            {' · '}
            {item.swellPeriodS !== null ? `${item.swellPeriodS} s` : DASH}
          </Text>
          {pct !== null && (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>{`+${pct}%`}</Text>
            </View>
          )}
        </View>
      )}
```

6. Estilos novos:
```tsx
    signalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    badge: {
      backgroundColor: theme.colors.accent,
      borderRadius: radius.chip,
      paddingHorizontal: space.sm,
      paddingVertical: space.xs2,
    },
    badgeLabel: { fontFamily: theme.font.bodySemiBold, fontSize: 11, color: theme.colors.accentOn },
```

**Limitação conhecida (aceitar, não corrigir):** o `spotSessions` sai da lista em memória (LIMIT 50), por isso o badge usa a média das últimas ≤50 sessões do spot, não de sempre. Os tiles usam o `getStats` e são exatos. Corrigir isto exigiria outra query de agregação por spot — e com <5 sessões o badge nem aparece. Comentar no código como limitação, não resolver agora.

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit`
Expected: zero erros.

Run: `npm test`
Expected: verde — 100 anteriores + 3 (Task 1) + 7 (Task 2) + 8 (Task 3) = **118**.

- [ ] **Step 6: Commit**

```bash
git add src/stores/statsStore.ts src/i18n/index.ts "src/app/(tabs)/index.tsx"
git commit -m "feat: tiles de estatisticas e badge de swell no cartao

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## DoD no dispositivo

1. Com sessões: a barra aparece no topo e faz scroll com a lista; os números batem certo com o histórico (contar as sessões à mão e conferir).
2. Um tile sem dado não aparece (ex.: sem sessões `ok`, o recorde some) — nada de "0" nem "—".
3. Com a lista vazia: sem barra, só o empty state.
4. Nos dois temas.
5. O badge não vai aparecer (precisa de 10 sessões `ok` no mesmo spot) — é o esperado hoje.

## Notas de comportamento assumidas (não são gaps)

- **O badge usa a média das ≤50 sessões em memória**, não de sempre (ver Task 4). Os tiles são exatos.
- **`sessionsBySpot` inclui spots arquivados** — foram surfados na mesma (mesma razão do histórico).
- **Com <5 sessões**: mostra "1 semana", um recorde e "Carcavelos · 4". O badge nunca aparece. Estrutura correta à espera de dados.
