import Database from 'better-sqlite3';

import { runMigrations } from '../migrationRunner';
import { migrations } from '../migrations';
import {
  createSessionRepo,
  rowToSessionListItem,
  type SessionListRow,
  type SessionRepository,
} from '../repositories/sessionRepo';
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

  test('(f) getLastUsedSpotId devolve o spot do registo mais recente; null sem sessões', async () => {
    expect(await repo.getLastUsedSpotId()).toBeNull();

    await repo.create({ spotId: 'spot-1', startedAt: 500, rating: 4 });
    // Mesmo created_at (clock parado): o rowid desempata pela ordem de inserção.
    await repo.create({ spotId: 'spot-2', startedAt: 100, rating: 3 });
    expect(await repo.getLastUsedSpotId()).toBe('spot-2'); // último REGISTADO, não último surfado
  });

  test('(g) rowToSessionListItem mapeia o row do JOIN de 3 tabelas (forma própria, não rowToSession)', () => {
    const row: SessionListRow = {
      id: 's-1',
      spot_id: 'spot-1',
      board_id: 'board-1',
      started_at: 111,
      duration_min: 90,
      rating: 5,
      crowd: 2,
      notes: 'glassy',
      created_at: 10,
      updated_at: 20,
      spot_name: 'Carcavelos',
      board_name: "6'2 Lost Driver",
      swell_height_m: 0.9,
      swell_period_s: 15.25,
      wind_speed_kmh: 16.9,
      wind_direction_deg: 322,
      tide_phase: 'falling',
      fetch_status: 'ok',
    };
    expect(rowToSessionListItem(row)).toEqual({
      id: 's-1',
      spotId: 'spot-1',
      boardId: 'board-1',
      startedAt: 111,
      durationMin: 90,
      rating: 5,
      crowd: 2,
      notes: 'glassy',
      createdAt: 10,
      updatedAt: 20,
      spotName: 'Carcavelos',
      boardName: "6'2 Lost Driver",
      swellHeightM: 0.9,
      swellPeriodS: 15.25,
      windSpeedKmh: 16.9,
      windDirectionDeg: 322,
      tidePhase: 'falling',
      fetchStatus: 'ok',
    });
  });

  test('(h) listWithDetails junta spot, board (LEFT) e resumo de condições com fetch_status', async () => {
    const withBoard = await repo.create({
      spotId: 'spot-1',
      boardId: 'board-1',
      startedAt: 2_000,
      rating: 5,
    });
    await repo.create({ spotId: 'spot-2', startedAt: 1_000, rating: 3 });
    raw
      .prepare(
        `UPDATE session_conditions SET fetch_status='ok', swell_height_m=0.9,
           swell_period_s=15.25, wind_speed_kmh=16.9, wind_direction_deg=322,
           tide_phase='falling' WHERE session_id=?`,
      )
      .run(withBoard.id);

    const items = await repo.listWithDetails(50, 0);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: withBoard.id,
      spotName: 'Carcavelos',
      boardName: "6'2 Lost Driver",
      swellHeightM: 0.9,
      swellPeriodS: 15.25,
      windSpeedKmh: 16.9,
      tidePhase: 'falling',
      fetchStatus: 'ok',
    });
    expect(items[1]).toMatchObject({
      spotName: 'Ericeira',
      boardName: null, // LEFT JOIN: sessão sem prancha
      swellHeightM: null,
      fetchStatus: 'pending', // nasce com a sessão
    });
  });

  test('(i) listWithDetails ordena por started_at DESC (hora de surf, não de registo) e pagina', async () => {
    // Registadas por esta ordem, mas surfadas noutra: a retroativa vai para o fim.
    await repo.create({ spotId: 'spot-1', startedAt: 5_000, rating: 4 });
    await repo.create({ spotId: 'spot-1', startedAt: 1_000, rating: 4 }); // retroativa
    await repo.create({ spotId: 'spot-1', startedAt: 9_000, rating: 4 });

    const all = await repo.listWithDetails(50, 0);
    expect(all.map((s) => s.startedAt)).toEqual([9_000, 5_000, 1_000]);

    expect((await repo.listWithDetails(2, 0)).map((s) => s.startedAt)).toEqual([9_000, 5_000]);
    expect((await repo.listWithDetails(2, 2)).map((s) => s.startedAt)).toEqual([1_000]);
  });

  test('(j) spot arquivado continua no histórico — a razão de ser do soft delete', async () => {
    await repo.create({ spotId: 'spot-1', startedAt: 111, rating: 4 });
    raw.prepare("UPDATE spots SET is_archived=1 WHERE id='spot-1'").run();

    const items = await repo.listWithDetails(50, 0);
    expect(items).toHaveLength(1);
    expect(items[0].spotName).toBe('Carcavelos');
  });

  test('(e) create com spot_id inexistente faz rollback: zero linhas em sessions E session_conditions', async () => {
    // FK ON: o insert em sessions falha; a transação desfaz e não deixa órfãos.
    await expect(repo.create({ spotId: 'ghost', startedAt: 111, rating: 4 })).rejects.toThrow();
    expect((raw.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }).n).toBe(0);
    expect(
      (raw.prepare('SELECT COUNT(*) AS n FROM session_conditions').get() as { n: number }).n,
    ).toBe(0);
  });

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
});
