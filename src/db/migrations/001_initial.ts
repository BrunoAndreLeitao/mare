import { type Migration } from '../migrationRunner';

// SQL from docs/DATABASE.md. schema_version is owned by the runner and the
// PRAGMAs live in getDatabase() — neither belongs here.
export const migration001: Migration = {
  version: 1,
  statements: [
    `-- ---------------------------------------------------------------
-- Spots: locais de surf do utilizador
-- ---------------------------------------------------------------
CREATE TABLE spots (
  id          TEXT PRIMARY KEY,              -- uuid v4
  name        TEXT NOT NULL,                 -- "Carcavelos", "Praia Grande"
  latitude    REAL NOT NULL,
  longitude   REAL NOT NULL,
  notes       TEXT,                          -- fundo, acessos, avisos pessoais
  is_archived INTEGER NOT NULL DEFAULT 0,    -- soft delete (sessões referem spots)
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
)`,
    `-- ---------------------------------------------------------------
-- Boards: quiver do utilizador
-- ---------------------------------------------------------------
CREATE TABLE boards (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,                 -- "6'2 Lost Driver"
  board_type  TEXT,                          -- shortboard|fish|funboard|longboard|gun|foam|other
  volume_l    REAL,                          -- litros, opcional
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
)`,
    `-- ---------------------------------------------------------------
-- Sessions: o registo de 30 segundos
-- ---------------------------------------------------------------
CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,
  spot_id       TEXT NOT NULL REFERENCES spots(id),
  board_id      TEXT REFERENCES boards(id),  -- opcional
  started_at    INTEGER NOT NULL,            -- epoch UTC; default: agora, editável
  duration_min  INTEGER,                     -- opcional; presets 30/60/90/120 na UI
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  crowd         INTEGER CHECK (crowd BETWEEN 1 AND 3),  -- 1=vazio 2=normal 3=cheio; opcional
  notes         TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
)`,
    `CREATE INDEX idx_sessions_spot_started ON sessions(spot_id, started_at DESC)`,
    `CREATE INDEX idx_sessions_started ON sessions(started_at DESC)`,
    `-- ---------------------------------------------------------------
-- Session conditions: snapshot das condições à hora da sessão
-- Preenchida assíncronamente pelo serviço openmeteo.
-- fetch_status: pending -> ok | failed (failed com retry_count para backoff)
-- ---------------------------------------------------------------
CREATE TABLE session_conditions (
  session_id            TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,

  -- Mar (Open-Meteo Marine API, hora mais próxima de sessions.started_at)
  wave_height_m         REAL,     -- wave_height (mar total combinado)
  wave_direction_deg    REAL,     -- wave_direction
  wave_period_s         REAL,     -- wave_period
  swell_height_m        REAL,     -- swell_wave_height (ondulação de fundo)
  swell_direction_deg   REAL,     -- swell_wave_direction
  swell_period_s        REAL,     -- swell_wave_period
  swell_peak_period_s   REAL,     -- swell_wave_peak_period
  wind_wave_height_m    REAL,     -- wind_wave_height (vaga de vento local)
  sea_level_msl_m       REAL,     -- sea_level_height_msl (proxy de maré)
  tide_phase            TEXT,     -- rising|falling|high|low — derivado (ver OPEN_METEO.md)
  water_temp_c          REAL,     -- sea_surface_temperature

  -- Vento (Open-Meteo Forecast API, mesma hora)
  wind_speed_kmh        REAL,     -- wind_speed_10m
  wind_gusts_kmh        REAL,     -- wind_gusts_10m
  wind_direction_deg    REAL,     -- wind_direction_10m
  wind_relation         TEXT,     -- offshore|onshore|cross|cross-off|cross-on — derivado
                                  -- da orientação do spot (Fase 4; requer campo futuro
                                  -- spots.facing_direction_deg via migration)

  -- Metadados de fetch
  fetch_status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (fetch_status IN ('pending','ok','failed')),
  retry_count           INTEGER NOT NULL DEFAULT 0,
  fetched_at            INTEGER,
  source                TEXT NOT NULL DEFAULT 'open-meteo',
  raw_json              TEXT      -- resposta bruta da hora usada (auditoria/debug)
)`,
    `CREATE INDEX idx_conditions_status ON session_conditions(fetch_status)`,
  ],
};
