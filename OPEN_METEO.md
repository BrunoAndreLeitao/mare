# Maré — Contrato Open-Meteo

Duas APIs, dois hosts, mesma família. Sem API key no free tier. **Ler a secção "Licenciamento" antes da Fase 5.**

| Dados | Host | Endpoint |
|---|---|---|
| Mar (ondas, swell, maré, temp. água) | `https://marine-api.open-meteo.com` | `/v1/marine` |
| Vento | `https://api.open-meteo.com` | `/v1/forecast` |

Ambos os hosts DEVEM ser configuráveis (`src/services/openmeteo/config.ts`) juntamente com uma `apiKey` opcional — no plano comercial os hosts mudam para `customer-*.open-meteo.com` e levam `&apikey=`. A migração comercial tem de ser uma mudança de config, não de código.

## 1. Pedido de condições de uma sessão (Marine)

A sessão tem `started_at` (epoch UTC). Pedimos o dia inteiro e escolhemos a hora mais próxima.

```
GET https://marine-api.open-meteo.com/v1/marine
  ?latitude={spot.latitude}
  &longitude={spot.longitude}
  &hourly=wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,swell_wave_peak_period,wind_wave_height,sea_level_height_msl,sea_surface_temperature
  &start_date={YYYY-MM-DD}          # data UTC de started_at
  &end_date={YYYY-MM-DD}            # mesma data
  &timeformat=unixtime
  &timezone=UTC
  &cell_selection=sea               # força seleção de célula marítima (spots costeiros!)
```

Exemplo real — Carcavelos (`38.678, -9.336`):

```
https://marine-api.open-meteo.com/v1/marine?latitude=38.678&longitude=-9.336&hourly=wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,swell_wave_peak_period,wind_wave_height,sea_level_height_msl,sea_surface_temperature&start_date=2026-07-02&end_date=2026-07-02&timeformat=unixtime&timezone=UTC&cell_selection=sea
```

Resposta (forma):

```jsonc
{
  "latitude": 38.7, "longitude": -9.3,
  "utc_offset_seconds": 0,
  "hourly_units": { "wave_height": "m", "wave_period": "s", "...": "..." },
  "hourly": {
    "time": [1751414400, 1751418000, ...],   // epoch, 24 valores
    "wave_height": [1.2, 1.3, ...],
    "swell_wave_height": [1.0, 1.1, ...],
    "sea_level_height_msl": [-0.8, -0.4, ...],
    // ... um array por variável pedida, alinhados por índice
  }
}
```

Erro: HTTP 400 com `{ "error": true, "reason": "..." }`. Tratar 400 como **falha permanente** (não repetir — o pedido está mal construído; log + `fetch_status='failed'` com `retry_count=5`). Tratar timeouts/5xx/sem rede como **falha temporária** (retry).

## 2. Pedido de vento (Forecast)

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude={lat}&longitude={lon}
  &hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m
  &start_date={YYYY-MM-DD}&end_date={YYYY-MM-DD}
  &wind_speed_unit=kmh
  &timeformat=unixtime&timezone=UTC
```

Os dois pedidos (marine + forecast) correm em paralelo (`Promise.allSettled`). Se só um falhar, gravar o que veio e manter `fetch_status='failed'` para completar o resto no retry — o update de condições é idempotente por coluna.

## 3. Matching de hora — regra exata (testar!)

```
índice = argmin(|hourly.time[i] - session.started_at|)
```

- Empate exato entre duas horas: escolher a anterior (a sessão decorreu maioritariamente nela).
- Se `|delta| > 5400` s (90 min): não gravar valores; `fetch_status='failed'` + log. Significa que a API devolveu um dia errado — bug nosso, não dela.
- **Teste obrigatório** com sessões às XX:29 e XX:31, e mudança WET/WEST (março/outubro) — tudo em UTC elimina o problema, o teste garante que ninguém reintroduz hora local.

## 4. Histórico e limites temporais

- `past_days` até **92** ou `start_date`/`end_date` — cobre registo retroativo de sessões até ~3 meses.
- Sessões mais antigas que isso (import futuro): usar a Historical/Archive API (`archive-api.open-meteo.com`) — fora do MVP; se `start_date` for rejeitado por antiguidade, marcar `failed` permanente com mensagem clara na UI ("condições indisponíveis para datas antigas").
- Forecast até 16 dias (`forecast_days=16`) — só relevante na Fase 5 (alertas).

## 5. Maré: `sea_level_height_msl` e derivação de `tide_phase`

Não é tabela de marés oficial — é altura modelada do nível do mar relativa ao MSL. Chega perfeitamente para classificar a fase:

```
h_prev = sea_level[idx-1], h = sea_level[idx], h_next = sea_level[idx+1]
se h > h_prev e h > h_next  -> "high"
se h < h_prev e h < h_next  -> "low"
se h_next > h               -> "rising"
senão                       -> "falling"
```

Nos limites do array (idx 0 ou 23), pedir também o dia adjacente OU aceitar classificação só com um vizinho. Guardar sempre o valor bruto `sea_level_msl_m` — o insight fino (Fase 4) usa o número, não só a fase.

## 6. Fila de pendentes (worker)

`src/services/openmeteo/pendingQueue.ts`:

1. Triggers: arranque da app; `netinfo` passa a online; pull-to-refresh no histórico.
2. `SELECT session_id FROM session_conditions WHERE fetch_status IN ('pending','failed') AND retry_count < 5 LIMIT 10`.
3. Processar **sequencialmente** com ~300 ms entre sessões (respeito pelo rate limit; free tier ≈ 10.000 chamadas/dia — nunca chegaremos perto, mas rajadas agressivas são má cidadania e podem levar a 429).
4. Backoff entre retries da mesma sessão: gerido naturalmente pelos triggers (não implementar scheduler próprio no MVP).
5. `retry_count >= 5`: UI mostra "condições indisponíveis" com botão manual "tentar novamente" (repõe `retry_count=0`).

## 7. Cache de dia (otimização barata, incluir no MVP)

Duas sessões no mesmo spot no mesmo dia UTC = mesma resposta. Cache em memória por chave `{lat_arredondada_2dec}|{lon}|{data}` durante o ciclo de vida do worker. Não persistir cache — o `raw_json` por sessão já cumpre o papel de registo.

## 8. Licenciamento — ⚠️ decisão de negócio embutida no código

- Free tier: **apenas uso não-comercial**, sem key, limites generosos (~10k req/dia).
- App gratuita/beta: OK. **App com subscrição ativa (Fase 5): uso comercial → plano pago obrigatório** (a partir de ~29 €/mês, com API key e SLA). Este valor entra no cálculo do break-even da Fase 5: aos 3,99 €/mês por subscritor, ~9-10 subscritores cobrem só a API.
- Alternativas a cotar na Fase 5 se fizer sentido: Stormglass, World Tides (só maré), Windy API. Manter o cliente agnóstico: interface `MarineDataProvider` com implementação `OpenMeteoProvider` — trocar de fornecedor = nova implementação, zero alterações a montante.

## 9. Tipos TypeScript (contrato interno)

```typescript
export interface HourlyMarineData {
  timeUtc: number;                 // epoch seconds
  waveHeightM: number | null;
  waveDirectionDeg: number | null;
  wavePeriodS: number | null;
  swellHeightM: number | null;
  swellDirectionDeg: number | null;
  swellPeriodS: number | null;
  swellPeakPeriodS: number | null;
  windWaveHeightM: number | null;
  seaLevelMslM: number | null;
  waterTempC: number | null;
}

export interface HourlyWindData {
  timeUtc: number;
  windSpeedKmh: number | null;
  windGustsKmh: number | null;
  windDirectionDeg: number | null;
}

export interface SessionConditionsSnapshot
  extends Omit<HourlyMarineData, 'timeUtc'>, Omit<HourlyWindData, 'timeUtc'> {
  matchedTimeUtc: number;
  tidePhase: 'rising' | 'falling' | 'high' | 'low' | null;
  source: 'open-meteo';
}

export interface MarineDataProvider {
  fetchDayConditions(lat: number, lon: number, dateUtc: string): Promise<HourlyMarineData[]>;
  fetchDayWind(lat: number, lon: number, dateUtc: string): Promise<HourlyWindData[]>;
}
```

Qualquer valor ausente na resposta é `null`, nunca `0` — zero é um valor meteorológico válido e confundi-los corrompe os insights.
