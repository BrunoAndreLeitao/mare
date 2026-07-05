import { type Migration } from '../migrationRunner';

import { migration001 } from './001_initial';

export { type Migration };

// Ordered, additive, never edited after publish (CLAUDE.md).
export const migrations: Migration[] = [migration001];
