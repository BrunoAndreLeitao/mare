// Composition point: wires repositories to the real device DB and real deps.
// The only place where repositories meet expo APIs; passing the SQLiteDatabase
// as SqlDb is also where tsc proves the structural fit.
import { randomUUID } from 'expo-crypto';

import { getDatabase } from './database';
import { type RepoDeps } from './sqlDb';
import { createBoardRepo, type BoardRepository } from './repositories/boardRepo';
import {
  createConditionsRepo,
  type ConditionsRepository,
} from './repositories/conditionsRepo';
import { createSessionRepo, type SessionRepository } from './repositories/sessionRepo';
import { createSpotRepo, type SpotRepository } from './repositories/spotRepo';

const deps: RepoDeps = {
  uuid: () => randomUUID(),
  now: () => Math.floor(Date.now() / 1000),
};

export async function getSpotRepo(): Promise<SpotRepository> {
  return createSpotRepo(await getDatabase(), deps);
}

export async function getBoardRepo(): Promise<BoardRepository> {
  return createBoardRepo(await getDatabase(), deps);
}

export async function getSessionRepo(): Promise<SessionRepository> {
  return createSessionRepo(await getDatabase(), deps);
}

export async function getConditionsRepo(): Promise<ConditionsRepository> {
  return createConditionsRepo(await getDatabase(), deps);
}
