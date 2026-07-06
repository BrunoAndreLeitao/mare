import Database from 'better-sqlite3';

import { runMigrations } from '../migrationRunner';
import { migrations } from '../migrations';
import {
  createSpotRepo,
  rowToSpot,
  type SpotRepository,
  type SpotRow,
} from '../repositories/spotRepo';
import { BetterSqliteDb, makeDeps } from './helpers/testDb';

describe('spotRepo', () => {
  let raw: Database.Database;
  let deps: ReturnType<typeof makeDeps>;
  let repo: SpotRepository;

  beforeEach(async () => {
    raw = new Database(':memory:');
    const db = new BetterSqliteDb(raw);
    await runMigrations(db, migrations);
    deps = makeDeps();
    repo = createSpotRepo(db, deps);
  });

  afterEach(() => {
    raw.close();
  });

  test('(a) create materialises defaults and persists', async () => {
    const created = await repo.create({
      name: 'Carcavelos',
      latitude: 38.6788,
      longitude: -9.3364,
    });

    expect(created).toEqual({
      id: 'uuid-1',
      name: 'Carcavelos',
      latitude: 38.6788,
      longitude: -9.3364,
      notes: null,
      isArchived: false,
      createdAt: 1_000,
      updatedAt: 1_000,
    });
    expect(await repo.getById('uuid-1')).toEqual(created);
  });

  test('(b) getById returns null for an unknown id', async () => {
    expect(await repo.getById('nope')).toBeNull();
  });

  test('(c) listActive excludes archived and orders by name (case-insensitive)', async () => {
    await repo.create({ name: 'praia grande', latitude: 38.9, longitude: -9.5 });
    await repo.create({ name: 'Carcavelos', latitude: 38.7, longitude: -9.3 });
    const ericeira = await repo.create({ name: 'Ericeira', latitude: 39.0, longitude: -9.4 });
    await repo.archive(ericeira.id);

    const names = (await repo.listActive()).map((s) => s.name);
    expect(names).toEqual(['Carcavelos', 'praia grande']);
  });

  test('(d) update changes only the given fields, bumps updatedAt, and returns the re-read row', async () => {
    const created = await repo.create({
      name: 'Carcavelos',
      latitude: 38.6788,
      longitude: -9.3364,
      notes: 'fundo de areia',
    });

    deps.clock.value = 2_000;
    const updated = await repo.update(created.id, { name: 'Carcavelos (tanque)' });

    expect(updated).toEqual({
      ...created,
      name: 'Carcavelos (tanque)',
      updatedAt: 2_000,
    });
    // The re-read is the promise — the return must equal a later getById.
    expect(updated).toEqual(await repo.getById(created.id));
  });

  test('(e) update throws for an unknown id', async () => {
    await expect(repo.update('nope', { name: 'x' })).rejects.toThrow('Spot not found: nope');
  });

  test('(f) archive hides the spot from listActive but keeps it readable', async () => {
    const spot = await repo.create({ name: 'Carcavelos', latitude: 38.7, longitude: -9.3 });

    deps.clock.value = 2_000;
    await repo.archive(spot.id);

    expect(await repo.listActive()).toEqual([]);
    expect(await repo.getById(spot.id)).toEqual({
      ...spot,
      isArchived: true,
      updatedAt: 2_000,
    });
  });

  test('(g) archive throws for an unknown id', async () => {
    await expect(repo.archive('nope')).rejects.toThrow('Spot not found: nope');
  });

  test('(h) rowToSpot maps snake_case and 0/1 flags', () => {
    const row: SpotRow = {
      id: 'id-1',
      name: 'Supertubos',
      latitude: 39.3436,
      longitude: -9.3646,
      notes: null,
      is_archived: 1,
      created_at: 10,
      updated_at: 20,
    };
    expect(rowToSpot(row)).toEqual({
      id: 'id-1',
      name: 'Supertubos',
      latitude: 39.3436,
      longitude: -9.3646,
      notes: null,
      isArchived: true,
      createdAt: 10,
      updatedAt: 20,
    });
  });

  test('(i) update with values identical to the current ones does not throw', async () => {
    // SQLite's changes counts rows touched, not rows whose values differ —
    // a no-op edit must still succeed and bump updatedAt.
    const created = await repo.create({ name: 'Carcavelos', latitude: 38.7, longitude: -9.3 });

    deps.clock.value = 2_000;
    const updated = await repo.update(created.id, {
      name: created.name,
      latitude: created.latitude,
      longitude: created.longitude,
    });

    expect(updated).toEqual({ ...created, updatedAt: 2_000 });
  });

  test('(j) update clears notes to SQL NULL with an explicit null', async () => {
    const created = await repo.create({
      name: 'Carcavelos',
      latitude: 38.6788,
      longitude: -9.3364,
      notes: 'fundo de areia',
    });

    deps.clock.value = 2_000;
    const updated = await repo.update(created.id, { notes: null });

    expect(updated).toEqual({ ...created, notes: null, updatedAt: 2_000 });
    expect(await repo.getById(created.id)).toEqual(updated);
  });
});
