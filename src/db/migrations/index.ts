export interface Migration {
  version: number;
  statements: string[];
}

// Ordered, additive, never edited after publish (CLAUDE.md).
// 001_initial enters here in the next backlog task.
export const migrations: Migration[] = [];
