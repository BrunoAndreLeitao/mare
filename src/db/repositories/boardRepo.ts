import { type RepoDeps, type SqlDb, type SqlValue } from '../sqlDb';
import { type Board, type BoardChanges, type BoardType, type NewBoard } from '../types';

// Not-found semantics: reads return null; mutations THROW if the id does not
// exist — a missing id in a mutation is a caller bug, not a normal state.
// Update semantics: undefined leaves a field untouched; explicit null clears
// a clearable field (boardType, volumeL) to SQL NULL — see BoardChanges.
export interface BoardRepository {
  create(input: NewBoard): Promise<Board>;
  getById(id: string): Promise<Board | null>;
  /** Boards with is_archived = 0. */
  listActive(): Promise<Board[]>;
  update(id: string, changes: BoardChanges): Promise<Board>;
  /** Soft delete (docs/DATABASE.md §Regras 4) — sessions keep referencing the board. */
  archive(id: string): Promise<void>;
}

// board_type is typed as BoardType | null (no runtime validation): the column
// is TEXT without CHECK and this repo is its only writer. If another writer
// appears (import, sync), runtime validation enters at that moment.
export interface BoardRow {
  id: string;
  name: string;
  board_type: BoardType | null;
  volume_l: number | null;
  is_archived: number;
  created_at: number;
  updated_at: number;
}

// Exported for isolated testing and reuse by sessionRepo's JOINs (Fase 2).
export function rowToBoard(row: BoardRow): Board {
  return {
    id: row.id,
    name: row.name,
    boardType: row.board_type,
    volumeL: row.volume_l,
    isArchived: row.is_archived !== 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createBoardRepo(db: SqlDb, deps: RepoDeps): BoardRepository {
  async function getById(id: string): Promise<Board | null> {
    const row = await db.getFirstAsync<BoardRow>(
      'SELECT * FROM boards WHERE id = ?',
      [id],
    );
    return row === null ? null : rowToBoard(row);
  }

  return {
    async create(input: NewBoard): Promise<Board> {
      const id = deps.uuid();
      const ts = deps.now();
      const boardType = input.boardType ?? null;
      const volumeL = input.volumeL ?? null;
      await db.runAsync(
        `INSERT INTO boards (id, name, board_type, volume_l, is_archived, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, ?, ?)`,
        [id, input.name, boardType, volumeL, ts, ts],
      );
      return {
        id,
        name: input.name,
        boardType,
        volumeL,
        isArchived: false,
        createdAt: ts,
        updatedAt: ts,
      };
    },

    getById,

    async listActive(): Promise<Board[]> {
      const rows = await db.getAllAsync<BoardRow>(
        'SELECT * FROM boards WHERE is_archived = 0 ORDER BY name COLLATE NOCASE',
        [],
      );
      return rows.map(rowToBoard);
    },

    async update(id: string, changes: BoardChanges): Promise<Board> {
      const sets: string[] = [];
      const params: SqlValue[] = [];
      if (changes.name !== undefined) {
        sets.push('name = ?');
        params.push(changes.name);
      }
      if (changes.boardType !== undefined) {
        sets.push('board_type = ?');
        params.push(changes.boardType);
      }
      if (changes.volumeL !== undefined) {
        sets.push('volume_l = ?');
        params.push(changes.volumeL);
      }
      sets.push('updated_at = ?');
      params.push(deps.now());
      params.push(id);

      const result = await db.runAsync(
        `UPDATE boards SET ${sets.join(', ')} WHERE id = ?`,
        params,
      );
      if (result.changes === 0) {
        throw new Error(`Board not found: ${id}`);
      }
      const board = await getById(id);
      if (board === null) {
        throw new Error(`Board not found: ${id}`);
      }
      return board;
    },

    async archive(id: string): Promise<void> {
      const result = await db.runAsync(
        'UPDATE boards SET is_archived = 1, updated_at = ? WHERE id = ?',
        [deps.now(), id],
      );
      if (result.changes === 0) {
        throw new Error(`Board not found: ${id}`);
      }
    },
  };
}
