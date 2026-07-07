import Database from 'better-sqlite3';

import { runMigrations } from '../migrationRunner';
import { migrations } from '../migrations';
import {
  buildSessionSetClause,
  createSessionRepo,
  type SessionRepository,
} from '../repositories/sessionRepo';
import { BetterSqliteDb, makeDeps } from './helpers/testDb';

// Pure function — no DB needed.
describe('buildSessionSetClause', () => {
  test('(a) mapeia só os campos fornecidos e acrescenta sempre updated_at', () => {
    const { clause, params } = buildSessionSetClause({ rating: 4 }, 2_000);
    expect(clause).toBe('rating = ?, updated_at = ?');
    expect(params).toEqual([4, 2_000]);
  });

  test('(b) mapeia todos os campos por ordem determinística', () => {
    const { clause, params } = buildSessionSetClause(
      {
        spotId: 'spot-2',
        boardId: 'board-1',
        startedAt: 111,
        durationMin: 60,
        rating: 5,
        crowd: 2,
        notes: 'glassy',
      },
      2_000,
    );
    expect(clause).toBe(
      'spot_id = ?, board_id = ?, started_at = ?, duration_min = ?, rating = ?, crowd = ?, notes = ?, updated_at = ?',
    );
    expect(params).toEqual(['spot-2', 'board-1', 111, 60, 5, 2, 'glassy', 2_000]);
  });
});

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
    expect((await repo.getById(s.id))!.rating).toBe(5);

    await expect(repo.update('nope', { rating: 3 })).rejects.toThrow('Session not found: nope');
  });

  test('(d) delete remove a sessão, o CASCADE limpa as condições, e id desconhecido lança', async () => {
    const s = await repo.create({ spotId: 'spot-1', startedAt: 111, rating: 4 });

    await repo.delete(s.id);
    expect(await repo.getById(s.id)).toBeNull();
    expect(conditions(s.id)).toBeUndefined(); // CASCADE

    await expect(repo.delete('nope')).rejects.toThrow('Session not found: nope');
  });
});
