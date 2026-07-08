import { type OpenMeteoConfig } from './config';
import {
  type FetchFn,
  type HourlyMarineData,
  type HourlyWindData,
  type MarineDataProvider,
} from './types';

// Thrown by the provider; the worker (Tarefa 5) reads `permanent` to decide
// markFailed(id, permanent). ONLY HTTP 400 is permanent (malformed request);
// 5xx, 429, no-network, timeout and a malformed 200 body all retry.
export class OpenMeteoError extends Error {
  constructor(
    message: string,
    readonly permanent: boolean,
  ) {
    super(message);
    this.name = 'OpenMeteoError';
    Object.setPrototypeOf(this, OpenMeteoError.prototype); // instanceof across transpile
  }
}

const MARINE_HOURLY =
  'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,' +
  'swell_wave_period,swell_wave_peak_period,wind_wave_height,sea_level_height_msl,' +
  'sea_surface_temperature';
const WIND_HOURLY = 'wind_speed_10m,wind_direction_10m,wind_gusts_10m';

function apiKeyParam(config: OpenMeteoConfig): string {
  return config.apiKey ? `&apikey=${config.apiKey}` : '';
}

export function buildMarineUrl(
  config: OpenMeteoConfig,
  lat: number,
  lon: number,
  dateUtc: string,
): string {
  return (
    `${config.marineHost}/v1/marine?latitude=${lat}&longitude=${lon}` +
    `&hourly=${MARINE_HOURLY}&start_date=${dateUtc}&end_date=${dateUtc}` +
    `&timeformat=unixtime&timezone=UTC&cell_selection=sea${apiKeyParam(config)}`
  );
}

export function buildWindUrl(
  config: OpenMeteoConfig,
  lat: number,
  lon: number,
  dateUtc: string,
): string {
  return (
    `${config.forecastHost}/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=${WIND_HOURLY}&start_date=${dateUtc}&end_date=${dateUtc}` +
    `&wind_speed_unit=kmh&timeformat=unixtime&timezone=UTC${apiKeyParam(config)}`
  );
}

// A value is kept only if it is a finite number; missing array, null, or a
// non-number all map to null (never 0 — 0 is a real reading and stays).
function numAt(hourly: Record<string, unknown>, key: string, i: number): number | null {
  const arr = hourly[key];
  if (!Array.isArray(arr)) return null;
  const v: unknown = arr[i];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// Validates the shape; only `time` is essential. A malformed 200 body is a
// temporary failure (D2, corrected): retry rather than burning the session.
function extractHourly(json: unknown): { hourly: Record<string, unknown>; time: number[] } {
  const hourly =
    typeof json === 'object' && json !== null
      ? ((json as Record<string, unknown>).hourly as Record<string, unknown> | undefined)
      : undefined;
  const time = hourly?.time;
  if (hourly === undefined || !Array.isArray(time)) {
    throw new OpenMeteoError('resposta sem hourly.time', false);
  }
  return { hourly, time: time as number[] };
}

export function parseMarine(json: unknown): HourlyMarineData[] {
  const { hourly, time } = extractHourly(json);
  return time.map((timeUtc, i) => ({
    timeUtc,
    waveHeightM: numAt(hourly, 'wave_height', i),
    waveDirectionDeg: numAt(hourly, 'wave_direction', i),
    wavePeriodS: numAt(hourly, 'wave_period', i),
    swellHeightM: numAt(hourly, 'swell_wave_height', i),
    swellDirectionDeg: numAt(hourly, 'swell_wave_direction', i),
    swellPeriodS: numAt(hourly, 'swell_wave_period', i),
    swellPeakPeriodS: numAt(hourly, 'swell_wave_peak_period', i),
    windWaveHeightM: numAt(hourly, 'wind_wave_height', i),
    seaLevelMslM: numAt(hourly, 'sea_level_height_msl', i),
    waterTempC: numAt(hourly, 'sea_surface_temperature', i),
  }));
}

export function parseWind(json: unknown): HourlyWindData[] {
  const { hourly, time } = extractHourly(json);
  return time.map((timeUtc, i) => ({
    timeUtc,
    windSpeedKmh: numAt(hourly, 'wind_speed_10m', i),
    windGustsKmh: numAt(hourly, 'wind_gusts_10m', i),
    windDirectionDeg: numAt(hourly, 'wind_direction_10m', i),
  }));
}

export function createOpenMeteoProvider(
  config: OpenMeteoConfig,
  fetchFn: FetchFn,
): MarineDataProvider {
  async function getJson(url: string): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const res = await fetchFn(url, controller.signal);
      if (!res.ok) {
        throw new OpenMeteoError(`HTTP ${res.status}`, res.status === 400);
      }
      return await res.json();
    } catch (error) {
      if (error instanceof OpenMeteoError) throw error;
      // network error, abort/timeout, or invalid JSON body — all temporary.
      throw new OpenMeteoError(`falha de rede/parsing: ${String(error)}`, false);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async fetchDayConditions(lat, lon, dateUtc) {
      return parseMarine(await getJson(buildMarineUrl(config, lat, lon, dateUtc)));
    },
    async fetchDayWind(lat, lon, dateUtc) {
      return parseWind(await getJson(buildWindUrl(config, lat, lon, dateUtc)));
    },
  };
}
