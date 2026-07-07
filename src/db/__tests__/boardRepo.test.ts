import Database from 'better-sqlite3';

import { runMigrations } from '../migrationRunner';
import { migrations } from '../migrations';
import {
  createBoardRepo,
  rowToBoard,
  type BoardRepository,
  type BoardRow,
} from '../repositories/boardRepo';
import { BetterSqliteDb, makeDeps } from './helpers/testDb';

describe('boardRepo', () => {
  let raw: Database.Database;
  let deps: ReturnType<typeof makeDeps>;
  let repo: BoardRepository;

  beforeEach(async () => {
    raw = new Database(':memory:');
    const db = new BetterSqliteDb(raw);
    await runMigrations(db, migrations);
    deps = makeDeps();
    repo = createBoardRepo(db, deps);
  });

  afterEach(() => {
    raw.close();
  });

  test('(a) create materialises defaults and persists', async () => {
    const created = await repo.create({ name: "6'2 Lost Driver" });

    expect(created).toEqual({
      id: 'uuid-1',
      name: "6'2 Lost Driver",
      boardType: null,
      volumeL: null,
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
    await repo.create({ name: 'mini simmons' });
    await repo.create({ name: 'Fish 5\'10' });
    const gun = await repo.create({ name: 'Gun 7\'6' });
    await repo.archive(gun.id);

    const names = (await repo.listActive()).map((b) => b.name);
    expect(names).toEqual(["Fish 5'10", 'mini simmons']);
  });

  test('(d) update changes only the given fields, bumps updatedAt, and returns the re-read row', async () => {
    const created = await repo.create({
      name: "6'2 Lost Driver",
      boardType: 'shortboard',
      volumeL: 29.5,
    });

    deps.clock.value = 2_000;
    const updated = await repo.update(created.id, { volumeL: 30.5, boardType: 'fish' });

    expect(updated).toEqual({
      ...created,
      volumeL: 30.5,
      boardType: 'fish',
      updatedAt: 2_000,
    });
    // The re-read is the promise — the return must equal a later getById.
    expect(updated).toEqual(await repo.getById(created.id));
  });

  test('(e) update throws for an unknown id', async () => {
    await expect(repo.update('nope', { name: 'x' })).rejects.toThrow('Board not found: nope');
  });

  test('(f) archive hides the board from listActive but keeps it readable', async () => {
    const board = await repo.create({ name: "6'2 Lost Driver" });

    deps.clock.value = 2_000;
    await repo.archive(board.id);

    expect(await repo.listActive()).toEqual([]);
    expect(await repo.getById(board.id)).toEqual({
      ...board,
      isArchived: true,
      updatedAt: 2_000,
    });
  });

  test('(g) archive throws for an unknown id', async () => {
    await expect(repo.archive('nope')).rejects.toThrow('Board not found: nope');
  });

  test('(h) rowToBoard maps snake_case and 0/1 flags', () => {
    const row: BoardRow = {
      id: 'id-1',
      name: 'Longboard 9\'1',
      board_type: 'longboard',
      volume_l: 65.2,
      is_archived: 1,
      created_at: 10,
      updated_at: 20,
    };
    expect(rowToBoard(row)).toEqual({
      id: 'id-1',
      name: "Longboard 9'1",
      boardType: 'longboard',
      volumeL: 65.2,
      isArchived: true,
      createdAt: 10,
      updatedAt: 20,
    });
  });

  test('(i) update with values identical to the current ones does not throw', async () => {
    // SQLite's changes counts rows touched, not rows whose values differ —
    // a no-op edit must still succeed and bump updatedAt.
    const created = await repo.create({
      name: "6'2 Lost Driver",
      boardType: 'shortboard',
      volumeL: 29.5,
    });

    deps.clock.value = 2_000;
    const updated = await repo.update(created.id, {
      name: created.name,
      boardType: 'shortboard',
      volumeL: 29.5,
    });

    expect(updated).toEqual({ ...created, updatedAt: 2_000 });
  });

  test('(j) update clears boardType and volumeL to SQL NULL with explicit nulls', async () => {
    const created = await repo.create({
      name: "6'2 Lost Driver",
      boardType: 'shortboard',
      volumeL: 29.5,
    });

    deps.clock.value = 2_000;
    const updated = await repo.update(created.id, { boardType: null, volumeL: null });

    expect(updated).toEqual({
      ...created,
      boardType: null,
      volumeL: null,
      updatedAt: 2_000,
    });
    expect(await repo.getById(created.id)).toEqual(updated);
  });
});
