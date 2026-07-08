import { type SqlValue } from './sqlDb';

// Table-agnostic partial-UPDATE builder: maps the provided domain fields to
// their columns via columnMap. undefined = leave the column untouched; null =
// write SQL NULL (this is what lets a partial conditions snapshot complete
// column-by-column across retries). Metadata columns — updated_at,
// fetch_status, fetched_at — are the repo's job, not this helper's, so it stays
// agnostic to any single table. Clause order follows the columnMap key order.
export function buildSetClause<K extends string>(
  changes: Partial<Record<K, SqlValue>>,
  columnMap: Record<K, string>,
): { clause: string; params: SqlValue[] } {
  const sets: string[] = [];
  const params: SqlValue[] = [];
  for (const field of Object.keys(columnMap) as K[]) {
    const value = changes[field];
    if (value !== undefined) {
      sets.push(`${columnMap[field]} = ?`);
      params.push(value);
    }
  }
  return { clause: sets.join(', '), params };
}
