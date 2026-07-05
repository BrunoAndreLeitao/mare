# Maré — Schema SQLite (v1)

Base de dados local via expo-sqlite. Migrations versionadas com tabela `schema_version` (padrão FitAPP). Todas as datas em **epoch seconds UTC** (INTEGER). Unidades: metros, segundos, km/h, graus.

## Diagrama lógico

```
spots 1──N sessions N──1 boards
              │
              1
              │
     session_conditions (1:1 com sessions, preenchida assíncronamente)
```

A separação `sessions` / `session_conditions` é deliberada: a sessão é criada instantaneamente pelo utilizador (offline-first); as condições chegam depois, via API, e podem falhar/repetir sem tocar no registo do utilizador.

## SQL — Migration 001_initial

> **Nota (2026-07-04):** a tabela `schema_version` é criada e gerida exclusivamente pelo runner (`src/db/migrationRunner.ts`) — as migrations nunca a tocam. Os PRAGMAs (`journal_mode=WAL`, `foreign_keys=ON`) vivem no `getDatabase()`: são por-conexão e não podem correr dentro da transação da migration.

```sql
-- ---------------------------------------------------------------
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
);

-- ---------------------------------------------------------------
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
);

-- ---------------------------------------------------------------
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
);

CREATE INDEX idx_sessions_spot_started ON sessions(spot_id, started_at DESC);
CREATE INDEX idx_sessions_started ON sessions(started_at DESC);

-- ---------------------------------------------------------------
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
);

CREATE INDEX idx_conditions_status ON session_conditions(fetch_status);
```

## Regras de integridade e fluxo

1. **Criar sessão = 2 inserts na mesma transação:** `sessions` + `session_conditions` com `fetch_status='pending'` e todos os valores NULL. A UI mostra "condições a obter…" e nunca bloqueia.
2. **O worker de fetch** (ver OPEN_METEO.md) processa `WHERE fetch_status IN ('pending','failed') AND retry_count < 5`, ao arrancar a app e ao recuperar conectividade (`@react-native-community/netinfo`).
3. **Editar `started_at` ou `spot_id` de uma sessão invalida as condições:** repor `fetch_status='pending'`, `retry_count=0`, limpar valores. Implementar no repository, não confiar na UI.
4. **Soft delete em spots/boards** (`is_archived`) — apagar de verdade quebraria o histórico. Sessões podem ser apagadas de verdade (CASCADE limpa as condições).
5. **`raw_json` guarda só o slice da hora usada**, não a resposta completa — a BD não deve crescer sem controlo. Estimar <2 KB por sessão; 500 sessões ≈ 1 MB. Irrelevante.

## Queries de referência

**Histórico (ecrã principal):**
```sql
SELECT s.*, sp.name AS spot_name, b.name AS board_name,
       c.wave_height_m, c.swell_period_s, c.wind_speed_kmh,
       c.wind_direction_deg, c.tide_phase, c.fetch_status
FROM sessions s
JOIN spots sp ON sp.id = s.spot_id
LEFT JOIN boards b ON b.id = s.board_id
LEFT JOIN session_conditions c ON c.session_id = s.id
ORDER BY s.started_at DESC
LIMIT 50 OFFSET ?;
```

**Insight básico por spot (Fase 4 — perfil das boas sessões):**
```sql
SELECT
  COUNT(*)                    AS n,
  AVG(c.swell_height_m)       AS avg_swell_h,
  MIN(c.swell_height_m)       AS min_swell_h,
  MAX(c.swell_height_m)       AS max_swell_h,
  AVG(c.swell_period_s)       AS avg_period,
  AVG(c.wind_speed_kmh)       AS avg_wind
FROM sessions s
JOIN session_conditions c ON c.session_id = s.id AND c.fetch_status = 'ok'
WHERE s.spot_id = ? AND s.rating >= 4;
```
O motor de insights (TypeScript, `src/services/insights/`) agrupa por buckets — altura em passos de 0.3 m, período em passos de 2 s, direção em setores de 45° — e só apresenta conclusões com `n >= 5` por bucket. Menos que isso é ruído vestido de insight.

## Evolução prevista (migrations futuras, NÃO criar já)

- `002`: `spots.facing_direction_deg` (orientação da praia p/ calcular `wind_relation`)
- `003`: tabela `alerts` (Fase 5 — perfis de alerta por spot)
- `004+`: campos de sync/backup se a Fase 6 (conta + cloud) se justificar
