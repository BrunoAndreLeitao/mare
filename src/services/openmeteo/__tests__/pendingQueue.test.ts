import { readFileSync } from 'fs';
import { join } from 'path';

import Database from 'better-sqlite3';

import { runMigrations } from '../../../db/migrationRunner';
import { migrations } from '../../../db/migrations';
import {
  createConditionsRepo,
  type ConditionsRepository,
} from '../../../db/repositories/conditionsRepo';
import { createSessionRepo, type SessionRepository } from '../../../db/repositories/sessionRepo';
import { BetterSqliteDb, makeDeps } from '../../../db/__tests__/helpers/testDb';
import { OpenMeteoError, parseMarine, parseWind } from '../provider';
import { PACING_MS, processPendingQueue, type PendingQueueDeps } from '../pendingQueue';
import { type HourlyMarineData, type HourlyWindData, type MarineDataProvider } from '../types';

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8'));
const realMarine = parseMarine(fixture('marine-2026-04-30.json'));
const realWind = parseWind(fixture('wind-2026-04-30.json'));

const DAY0 = 1_777_507_200; // 2026-04-30T00:00:00Z (dia das fixtures)
const AT_1320 = 1_777_555_200; // 13:20:00Z → casa idx 13 (15.25s/0.90m, tide high)

// Wind sintético com valor distinto por hora — para a paranoia da cola
// wind-only: o valor gravado denuncia o índice escolhido.
const syntheticWind: HourlyWindData[] = Array.from({ length: 24 }, (_, i) => ({
  timeUtc: DAY0 + i * 3_600,
  windSpeedKmh: i,
  windGustsKmh: i + 100,
  windDirectionDeg: 180,
}));

// Provider stub à mão (zero mocks de biblioteca): array = sucesso, Error = throw.
function makeProvider(
  marine: HourlyMarineData[] | Error,
  wind: HourlyWindData[] | Error,
): { provider: MarineDataProvider; calls: { marine: number; wind: number } } {
  const calls = { marine: 0, wind: 0 };
  return {
    calls,
    provider: {
      async fetchDayConditions() {
        calls.marine++;
        if (marine instanceof Error) throw marine;
        return marine;
      },
      async fetchDayWind() {
        calls.wind++;
        if (wind instanceof Error) throw wind;
        return wind;
      },
    },
  };
}

describe('processPendingQueue', () => {
  let raw: Database.Database;
  let conditions: ConditionsRepository;
  let sessions: SessionRepository;
  let callLog: string[];
  let sleeps: number[];

  const newSession = (startedAt: number) =>
    sessions.create({ spotId: 'spot-1', startedAt, rating: 4 });

  // Envolve o repo real num call-log para asserções de ordem.
  const loggedConditions = (repo: ConditionsRepository): ConditionsRepository => ({
    getBySessionId: (id) => repo.getBySessionId(id),
    listFetchable: (limit) => {
      callLog.push('listFetchable');
      return repo.listFetchable(limit);
    },
    saveSnapshot: (id, values) => {
      callLog.push('saveSnapshot');
      return repo.saveSnapshot(id, values);
    },
    markFailed: (id, permanent) => {
      callLog.push(`markFailed(${permanent})`);
      return repo.markFailed(id, permanent);
    },
    resetRetries: (id) => repo.resetRetries(id),
  });

  const makeQueueDeps = (provider: MarineDataProvider, online = true): PendingQueueDeps => ({
    conditions: loggedConditions(conditions),
    provider,
    isOnline: async () => online,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });

  beforeEach(async () => {
    raw = new Database(':memory:');
    raw.pragma('foreign_keys = ON');
    const db = new BetterSqliteDb(raw);
    await runMigrations(db, migrations);
    raw.exec(`
      INSERT INTO spots (id, name, latitude, longitude, is_archived, created_at, updated_at)
        VALUES ('spot-1', 'Carcavelos', 38.6788, -9.3364, 0, 1, 1);
    `);
    const deps = makeDeps();
    conditions = createConditionsRepo(db, deps);
    sessions = createSessionRepo(db, deps);
    callLog = [];
    sleeps = [];
  });

  afterEach(() => {
    raw.close();
  });

  test('(a) fila vazia: zero chamadas ao provider, resultado a zeros', async () => {
    const { provider, calls } = makeProvider(realMarine, realWind);
    const result = await processPendingQueue(makeQueueDeps(provider));
    expect(result).toEqual({ processed: 0, ok: 0, partial: 0, failed: 0 });
    expect(calls).toEqual({ marine: 0, wind: 0 });
  });

  test('(b) offline: retorno imediato, listFetchable nem é chamado', async () => {
    await newSession(AT_1320);
    const { provider, calls } = makeProvider(realMarine, realWind);
    const result = await processPendingQueue(makeQueueDeps(provider, false));
    expect(result.processed).toBe(0);
    expect(callLog).toEqual([]); // nem listFetchable
    expect(calls).toEqual({ marine: 0, wind: 0 });
  });

  test('(c) sucesso completo com fixtures reais: valores + tide + rawJson, status ok', async () => {
    const s = await newSession(AT_1320);
    const { provider } = makeProvider(realMarine, realWind);
    const result = await processPendingQueue(makeQueueDeps(provider));

    expect(result).toEqual({ processed: 1, ok: 1, partial: 0, failed: 0 });
    const c = (await conditions.getBySessionId(s.id))!;
    expect(c).toMatchObject({
      fetchStatus: 'ok',
      swellPeriodS: 15.25,
      swellHeightM: 0.9,
      tidePhase: 'high',
      windSpeedKmh: null, // real: o wind desta fixture é null às 13:00
    });
    expect(c.fetchedAt).not.toBeNull();
    expect(c.rawJson).toContain('"swellPeriodS":15.25');
  });

  test('(d) parcial marine-ok/wind-falha: saveSnapshot ANTES de markFailed, valores ficam, retry_count=1, continua na fila', async () => {
    const s = await newSession(AT_1320);
    const { provider } = makeProvider(realMarine, new OpenMeteoError('timeout', false));
    const result = await processPendingQueue(makeQueueDeps(provider));

    expect(result).toEqual({ processed: 1, ok: 0, partial: 1, failed: 0 });
    expect(callLog).toEqual(['listFetchable', 'saveSnapshot', 'markFailed(false)']); // a ordem do contrato
    const c = (await conditions.getBySessionId(s.id))!;
    expect(c).toMatchObject({
      fetchStatus: 'failed',
      retryCount: 1,
      swellPeriodS: 15.25,
      windSpeedKmh: null, // ausente (nunca escrito), não apagado
    });
    expect((await conditions.listFetchable(10)).map((f) => f.sessionId)).toContain(s.id);
  });

  test('(e) parcial wind-only com paranoia de tempo: sessão às 13:31 casa a hora 14 do wind', async () => {
    const s = await newSession(DAY0 + 13 * 3_600 + 31 * 60); // 13:31 → hora seguinte
    const { provider } = makeProvider(new OpenMeteoError('HTTP 503', false), syntheticWind);
    const result = await processPendingQueue(makeQueueDeps(provider));

    expect(result.partial).toBe(1);
    const c = (await conditions.getBySessionId(s.id))!;
    expect(c).toMatchObject({
      fetchStatus: 'failed',
      retryCount: 1,
      windSpeedKmh: 14, // idx 14 — se fosse 13, o argmin da cola estava errado
      windGustsKmh: 114,
      swellPeriodS: null, // marine nunca chegou
    });
  });

  test('(f) AND, não OR: marine 400 (permanente) + wind timeout (temporário) → NÃO permanente', async () => {
    const s = await newSession(AT_1320);
    const { provider } = makeProvider(
      new OpenMeteoError('HTTP 400', true),
      new OpenMeteoError('timeout', false),
    );
    const result = await processPendingQueue(makeQueueDeps(provider));

    expect(result.failed).toBe(1);
    const c = (await conditions.getBySessionId(s.id))!;
    expect(c).toMatchObject({ fetchStatus: 'failed', retryCount: 1 }); // não 5
    expect((await conditions.listFetchable(10)).map((f) => f.sessionId)).toContain(s.id); // o vento ainda é recuperável
  });

  test('(g) ambos permanentes (400+400) → markFailed(true): retry_count=5, sai da fila', async () => {
    const s = await newSession(AT_1320);
    const { provider } = makeProvider(
      new OpenMeteoError('HTTP 400', true),
      new OpenMeteoError('HTTP 400', true),
    );
    await processPendingQueue(makeQueueDeps(provider));

    expect((await conditions.getBySessionId(s.id))!.retryCount).toBe(5);
    expect(await conditions.listFetchable(10)).toEqual([]);
  });

  test('(h) cache de dia: 2 sessões no mesmo spot/dia → 1 chamada por metade; sleep(300) entre sessões, não após a última', async () => {
    await newSession(AT_1320);
    await newSession(DAY0 + 15 * 3_600); // 15:00 do mesmo dia
    const { provider, calls } = makeProvider(realMarine, realWind);
    const result = await processPendingQueue(makeQueueDeps(provider));

    expect(result.ok).toBe(2);
    expect(calls).toEqual({ marine: 1, wind: 1 }); // a cache evitou a 2ª chamada
    expect(sleeps).toEqual([PACING_MS]); // 2 sessões → exatamente 1 pausa
  });

  test('(i) retry_count >= 5 nunca é puxado', async () => {
    const s = await newSession(AT_1320);
    await conditions.markFailed(s.id, true); // enterra: retry_count=5
    const { provider, calls } = makeProvider(realMarine, realWind);
    const result = await processPendingQueue(makeQueueDeps(provider));

    expect(result.processed).toBe(0);
    expect(calls).toEqual({ marine: 0, wind: 0 });
  });

  test('(j) dia errado (delta > 5400s): não grava valores, markFailed(false) para auto-recuperar pós-fix', async () => {
    // A sessão é de um dia FORA das fixtures — o provider stub devolve o dia
    // errado, simulando o bug do §3.
    const s = await newSession(DAY0 + 26 * 3_600);
    const { provider } = makeProvider(realMarine, realWind);
    const result = await processPendingQueue(makeQueueDeps(provider));

    expect(result.failed).toBe(1);
    const c = (await conditions.getBySessionId(s.id))!;
    expect(c).toMatchObject({
      fetchStatus: 'failed',
      retryCount: 1, // não permanente
      swellPeriodS: null, // nada gravado
      rawJson: null,
    });
  });
});
