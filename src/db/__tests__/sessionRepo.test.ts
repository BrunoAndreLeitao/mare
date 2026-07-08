import Database from 'better-sqlite3';

import { runMigrations } from '../migrationRunner';
import { migrations } from '../migrations';
import { createSessionRepo, type SessionRepository } from '../repositories/sessionRepo';
import { BetterSqliteDb, makeDeps } from './helpers/testDb';

// buildSetClause (o antigo buildSessionSetClause, agora genérico) tem os seus
// testes isolados em setClause.test.ts.
describe('sessionRepo', () => {
  let raw: Database.Database;
  let deps: ReturnType<typeof makeDeps>;
  let repo: SessionRepository;

  // Reads the conditions row directly — the ConditionsRepository is Tarefa 2.
  const conditions = (id: string) =>
    raw.prepare('SELECT * FROM session_conditions WHERE session_id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
  const seedFetched = (id: string) =>
    raw
      .prepare(
        `UPDATE session_conditions SET fetch_status='ok', retry_count=2,
           wave_height_m=1.5, tide_phase='rising', fetched_at=555 WHERE session_id=?`,
      )
      .run(id);

  beforeEach(async () => {
    raw = new Database(':memory:');
    // Prod enables this per-connection in getDatabase(); the test adapter does
    // not, and without it the delete CASCADE below would pass vacuously.
    raw.pragma('foreign_keys = ON');
    const db = new BetterSqliteDb(raw);
    await runMigrations(db, migrations);
    // FK parents for sessions.spot_id / board_id.
    raw.exec(`
      INSERT INTO spots (id, name, latitude, longitude, is_archived, created_at, updated_at)
        VALUES ('spot-1', 'Carcavelos', 38.68, -9.33, 0, 1, 1),
               ('spot-2', 'Ericeira', 39.0, -9.4, 0, 1, 1);
      INSERT INTO boards (id, name, is_archived, created_at, updated_at)
        VALUES ('board-1', '6''2 Lost Driver', 0, 1, 1);
    `);
    deps = makeDeps();
    repo = createSessionRepo(db, deps);
  });

  afterEach(() => {
    raw.close();
  });

  test('(a) create preserva started_at do input, usa now() só em created_at/updated_at, e a linha de condições nasce pending/NULL', async () => {
    const surfedAt = 1_700_000_000;
    deps.clock.value = 1_700_009_999; // hora do registo, distinta da ocorrência
    const created = await repo.create({ spotId: 'spot-1', startedAt: surfedAt, rating: 4 });

    expect(created).toEqual({
      id: 'uuid-1',
      spotId: 'spot-1',
      boardId: null,
      startedAt: surfedAt,
      durationMin: null,
      rating: 4,
      crowd: null,
      notes: null,
      createdAt: 1_700_009_999,
      updatedAt: 1_700_009_999,
    });
    // Ocorrência ≠ registo: a fundação do matching.
    expect(created.startedAt).not.toBe(created.createdAt);
    expect(await repo.getById('uuid-1')).toEqual(created);

    const cond = conditions('uuid-1');
    expect(cond).toMatchObject({
      fetch_status: 'pending',
      retry_count: 0,
      source: 'open-meteo',
      wave_height_m: null,
      fetched_at: null,
    });

    // Materialização dos opcionais numa segunda sessão.
    const full = await repo.create({
      spotId: 'spot-1',
      boardId: 'board-1',
      startedAt: 222,
      durationMin: 90,
      rating: 5,
      crowd: 3,
      notes: 'pumping',
    });
    expect(full).toMatchObject({ boardId: 'board-1', durationMin: 90, crowd: 3, notes: 'pumping' });
    expect(await repo.getById(full.id)).toEqual(full);
  });

  test('(b) update de started_at OU spot_id invalida as condições', async () => {
    const s = await repo.create({ spotId: 'spot-1', startedAt: 111, rating: 4 });

    seedFetched(s.id);
    deps.clock.value = 2_000;
    await repo.update(s.id, { startedAt: 222 });
    expect(conditions(s.id)).toMatchObject({
      fetch_status: 'pending',
      retry_count: 0,
      wave_height_m: null,
      tide_phase: null,
      fetched_at: null,
    });

    seedFetched(s.id);
    await repo.update(s.id, { spotId: 'spot-2' });
    expect(conditions(s.id)).toMatchObject({ fetch_status: 'pending', wave_height_m: null });
  });

  test('(c) update que não toca started_at/spot_id NÃO invalida; no-op de started_at também não; id desconhecido lança', async () => {
    const s = await repo.create({ spotId: 'spot-1', startedAt: 111, rating: 4 });
    seedFetched(s.id);
    deps.clock.value = 2_000;

    await repo.update(s.id, { rating: 5 });
    expect(conditions(s.id)).toMatchObject({ fetch_status: 'ok', wave_height_m: 1.5 });

    await repo.update(s.id, { startedAt: 111 }); // mesmo valor: sem invalidação
    expect(conditions(s.id)).toMatchObject({ fetch_status: 'ok', wave_height_m: 1.5 });
    const after = (await repo.getById(s.id))!;
    expect(after.rating).toBe(5);
    expect(after.updatedAt).toBe(2_000); // o repo anexa updated_at fora do helper

    await expect(repo.update('nope', { rating: 3 })).rejects.toThrow('Session not found: nope');
  });

  test('(d) delete remove a sessão, o CASCADE limpa as condições, e id desconhecido lança', async () => {
    const s = await repo.create({ spotId: 'spot-1', startedAt: 111, rating: 4 });

    await repo.delete(s.id);
    expect(await repo.getById(s.id)).toBeNull();
    expect(conditions(s.id)).toBeUndefined(); // CASCADE

    await expect(repo.delete('nope')).rejects.toThrow('Session not found: nope');
  });

  test('(e) create com spot_id inexistente faz rollback: zero linhas em sessions E session_conditions', async () => {
    // FK ON: o insert em sessions falha; a transação desfaz e não deixa órfãos.
    await expect(repo.create({ spotId: 'ghost', startedAt: 111, rating: 4 })).rejects.toThrow();
    expect((raw.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }).n).toBe(0);
    expect(
      (raw.prepare('SELECT COUNT(*) AS n FROM session_conditions').get() as { n: number }).n,
    ).toBe(0);
  });
});
