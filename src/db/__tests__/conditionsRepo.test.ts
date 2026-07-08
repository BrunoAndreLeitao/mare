import Database from 'better-sqlite3';

import { runMigrations } from '../migrationRunner';
import { migrations } from '../migrations';
import {
  createConditionsRepo,
  type ConditionsRepository,
} from '../repositories/conditionsRepo';
import { createSessionRepo, type SessionRepository } from '../repositories/sessionRepo';
import { BetterSqliteDb, makeDeps } from './helpers/testDb';

describe('conditionsRepo', () => {
  let raw: Database.Database;
  let deps: ReturnType<typeof makeDeps>;
  let repo: ConditionsRepository;
  let sessions: SessionRepository;

  // Seeds a real session (and its pending conditions row) via sessionRepo.
  const newSession = (startedAt: number, spotId = 'spot-1') =>
    sessions.create({ spotId, startedAt, rating: 4 });

  beforeEach(async () => {
    raw = new Database(':memory:');
    raw.pragma('foreign_keys = ON');
    const db = new BetterSqliteDb(raw);
    await runMigrations(db, migrations);
    raw.exec(`
      INSERT INTO spots (id, name, latitude, longitude, is_archived, created_at, updated_at)
        VALUES ('spot-1', 'Carcavelos', 38.68, -9.33, 0, 1, 1),
               ('spot-2', 'Ericeira', 39.0, -9.4, 0, 1, 1);
    `);
    deps = makeDeps();
    repo = createConditionsRepo(db, deps);
    sessions = createSessionRepo(db, deps);
  });

  afterEach(() => {
    raw.close();
  });

  test('(a) getBySessionId devolve a linha pending que nasce com a sessão; null em desconhecido', async () => {
    const s = await newSession(111);
    const c = await repo.getBySessionId(s.id);
    expect(c).toMatchObject({
      sessionId: s.id,
      fetchStatus: 'pending',
      retryCount: 0,
      waveHeightM: null,
      windSpeedKmh: null,
      fetchedAt: null,
      source: 'open-meteo',
    });
    expect(await repo.getBySessionId('nope')).toBeNull();
  });

  test('(b) saveSnapshot completo escreve valores, marca ok e fetched_at', async () => {
    const s = await newSession(111);
    deps.clock.value = 9_000;
    await repo.saveSnapshot(s.id, {
      waveHeightM: 1.5,
      swellPeriodS: 12,
      tidePhase: 'rising',
      windSpeedKmh: 14,
      seaLevelMslM: 0, // zero é válido, não deve virar null
    });
    const c = (await repo.getBySessionId(s.id))!;
    expect(c).toMatchObject({
      fetchStatus: 'ok',
      fetchedAt: 9_000,
      waveHeightM: 1.5,
      swellPeriodS: 12,
      tidePhase: 'rising',
      windSpeedKmh: 14,
      seaLevelMslM: 0,
    });
  });

  test('(c) sequência parcial: saveSnapshot(marine) → markFailed(false) mantém valores, fica failed e fetchable; o retry com wind completa sem clobber', async () => {
    const s = await newSession(111);

    // Metade marine chega; wind falhou.
    await repo.saveSnapshot(s.id, { waveHeightM: 1.2, swellPeriodS: 11 });
    await repo.markFailed(s.id, false);
    let c = (await repo.getBySessionId(s.id))!;
    expect(c).toMatchObject({ fetchStatus: 'failed', retryCount: 1, waveHeightM: 1.2, swellPeriodS: 11 });
    expect((await repo.listFetchable(10)).map((f) => f.sessionId)).toContain(s.id);

    // Retry: wind completa; os valores de marine não são apagados (idempotente por coluna).
    await repo.saveSnapshot(s.id, { windSpeedKmh: 20, windDirectionDeg: 300 });
    c = (await repo.getBySessionId(s.id))!;
    expect(c).toMatchObject({
      fetchStatus: 'ok',
      waveHeightM: 1.2,
      swellPeriodS: 11,
      windSpeedKmh: 20,
      windDirectionDeg: 300,
    });
  });

  test('(d) markFailed permanente salta para 5 e sai da fila; não-permanente incrementa', async () => {
    const s = await newSession(111);

    await repo.markFailed(s.id, false);
    await repo.markFailed(s.id, false);
    expect((await repo.getBySessionId(s.id))!.retryCount).toBe(2);

    await repo.markFailed(s.id, true);
    const c = (await repo.getBySessionId(s.id))!;
    expect(c).toMatchObject({ fetchStatus: 'failed', retryCount: 5 });
    expect((await repo.listFetchable(10)).map((f) => f.sessionId)).not.toContain(s.id);
  });

  test('(e) resetRetries repõe pending/0 e devolve a sessão à fila', async () => {
    const s = await newSession(111);
    await repo.markFailed(s.id, true);
    await repo.resetRetries(s.id);
    expect(await repo.getBySessionId(s.id)).toMatchObject({ fetchStatus: 'pending', retryCount: 0 });
    expect((await repo.listFetchable(10)).map((f) => f.sessionId)).toContain(s.id);
  });

  test('(f) listFetchable devolve FetchableSession com lat/lon do spot e startedAt epoch cru; exclui ok; respeita o limit', async () => {
    const s1 = await newSession(1_700_000_000, 'spot-1');
    const s2 = await newSession(1_700_003_600, 'spot-2');
    const done = await newSession(1_700_007_200, 'spot-1');
    await repo.saveSnapshot(done.id, { waveHeightM: 1 }); // vira 'ok' → fora da fila

    const all = await repo.listFetchable(10);
    expect(all.map((f) => f.sessionId).sort()).toEqual([s1.id, s2.id].sort());
    const f2 = all.find((f) => f.sessionId === s2.id)!;
    expect(f2).toEqual({
      sessionId: s2.id,
      latitude: 39.0,
      longitude: -9.4,
      startedAtUtc: 1_700_003_600, // igual ao input, sem conversão
    });

    expect(await repo.listFetchable(1)).toHaveLength(1);
  });

  test('(g) saveSnapshot, markFailed e resetRetries lançam em session id desconhecido', async () => {
    await expect(repo.saveSnapshot('nope', { waveHeightM: 1 })).rejects.toThrow(
      'Conditions not found: nope',
    );
    await expect(repo.markFailed('nope', false)).rejects.toThrow('Conditions not found: nope');
    await expect(repo.resetRetries('nope')).rejects.toThrow('Conditions not found: nope');
  });
});
