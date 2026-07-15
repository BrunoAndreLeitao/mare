// Domain types for the SQLite schema (docs/DATABASE.md).
//
// Conventions:
// - Domain is camelCase; DB columns are snake_case. Row -> domain mapping is
//   the exclusive responsibility of repository implementations (Fases 1-2);
//   row types are born alongside those implementations, not here.
// - Dates are epoch seconds UTC (number), as stored.
// - Read types use `| null` for absent values, never undefined (mirrors SQL
//   NULL; absent is null, never 0 — see docs/OPEN_METEO.md).
// - Creation inputs (New*) use optional properties instead; the repo
//   materialises omissions as NULL and generates id/createdAt/updatedAt.

export type BoardType =
  | 'shortboard'
  | 'fish'
  | 'funboard'
  | 'longboard'
  | 'gun'
  | 'foam'
  | 'other';

export type Rating = 1 | 2 | 3 | 4 | 5; // CHECK (rating BETWEEN 1 AND 5)
export type Crowd = 1 | 2 | 3; // CHECK (crowd BETWEEN 1 AND 3)
export type TidePhase = 'rising' | 'falling' | 'high' | 'low';
export type WindRelation = 'offshore' | 'onshore' | 'cross' | 'cross-off' | 'cross-on';
export type FetchStatus = 'pending' | 'ok' | 'failed';

export interface Spot {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  notes: string | null;
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface NewSpot {
  name: string;
  latitude: number;
  longitude: number;
  notes?: string;
}

// Update input: unlike Partial<NewSpot>, clearable fields accept an explicit
// null so edit screens can wipe them to SQL NULL (undefined = leave untouched).
export interface SpotChanges {
  name?: string;
  latitude?: number;
  longitude?: number;
  notes?: string | null;
}

export interface Board {
  id: string;
  name: string;
  boardType: BoardType | null;
  volumeL: number | null;
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface NewBoard {
  name: string;
  boardType?: BoardType;
  volumeL?: number;
}

// Update input — same semantics as SpotChanges: undefined leaves a field
// untouched, explicit null clears it to SQL NULL.
export interface BoardChanges {
  name?: string;
  boardType?: BoardType | null;
  volumeL?: number | null;
}

// Read-model the fetch worker consumes: the conditions repo joins sessions and
// spots so ALL SQL stays in the repo layer (the worker gets lat/lon + the raw
// epoch startedAt without touching SQL itself). startedAtUtc is the stored
// epoch UTC, no timezone conversion — the provider builds the request from it.
export interface FetchableSession {
  sessionId: string;
  latitude: number;
  longitude: number;
  startedAtUtc: number;
}

export interface Session {
  id: string;
  spotId: string;
  boardId: string | null;
  startedAt: number;
  durationMin: number | null;
  rating: Rating;
  crowd: Crowd | null;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface NewSession {
  spotId: string;
  boardId?: string;
  startedAt: number;
  rating: Rating;
  durationMin?: number;
  crowd?: Crowd;
  notes?: string;
}

// Update input — same semantics as SpotChanges: undefined leaves a field
// untouched, explicit null clears it to SQL NULL. spotId, startedAt and rating
// are NOT NULL columns, so they cannot be cleared.
export interface SessionChanges {
  spotId?: string;
  boardId?: string | null;
  startedAt?: number;
  rating?: Rating;
  durationMin?: number | null;
  crowd?: Crowd | null;
  notes?: string | null;
}

// Measurement values of a conditions snapshot — everything the fetch worker
// writes, minus identity and fetch metadata. All partial and nullable: marine
// and forecast can fail independently, and the update is idempotent per
// column (docs/OPEN_METEO.md §2).
export interface ConditionValues {
  waveHeightM?: number | null;
  waveDirectionDeg?: number | null;
  wavePeriodS?: number | null;
  swellHeightM?: number | null;
  swellDirectionDeg?: number | null;
  swellPeriodS?: number | null;
  swellPeakPeriodS?: number | null;
  windWaveHeightM?: number | null;
  seaLevelMslM?: number | null;
  tidePhase?: TidePhase | null;
  waterTempC?: number | null;
  windSpeedKmh?: number | null;
  windGustsKmh?: number | null;
  windDirectionDeg?: number | null;
  windRelation?: WindRelation | null;
  rawJson?: string | null;
}

export interface SessionConditions {
  sessionId: string;
  waveHeightM: number | null;
  waveDirectionDeg: number | null;
  wavePeriodS: number | null;
  swellHeightM: number | null;
  swellDirectionDeg: number | null;
  swellPeriodS: number | null;
  swellPeakPeriodS: number | null;
  windWaveHeightM: number | null;
  seaLevelMslM: number | null;
  tidePhase: TidePhase | null;
  waterTempC: number | null;
  windSpeedKmh: number | null;
  windGustsKmh: number | null;
  windDirectionDeg: number | null;
  windRelation: WindRelation | null;
  fetchStatus: FetchStatus;
  retryCount: number;
  fetchedAt: number | null;
  source: string;
  rawJson: string | null;
}

// One row of the history screen, aligned with the reference query in
// docs/DATABASE.md (JOIN spots, LEFT JOIN boards, LEFT JOIN conditions).
// fetchStatus is non-null because a conditions row is created in the same
// transaction as the session (docs/DATABASE.md §Regras 1).
// swellHeightM (not waveHeightM): validated product call — total height
// misleads at Carcavelos; swell+period is the discriminating pair (see doc).
export interface SessionListItem extends Session {
  spotName: string;
  boardName: string | null;
  swellHeightM: number | null;
  swellPeriodS: number | null;
  windSpeedKmh: number | null;
  windDirectionDeg: number | null;
  tidePhase: TidePhase | null;
  fetchStatus: FetchStatus;
}
