import { readFileSync } from 'fs';
import { join } from 'path';

import { DEFAULT_CONFIG, type OpenMeteoConfig } from '../config';
import {
  OpenMeteoError,
  buildMarineUrl,
  buildWindUrl,
  createOpenMeteoProvider,
  parseMarine,
  parseWind,
} from '../provider';
import { type FetchFn } from '../types';

// Fixtures are 3 real Carcavelos days captured from the public API; tests read
// the files, never the network.
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8'));
// Valores ancorados nas horas validadas no dispositivo (30/04 idx 13; 02/05 e
// 07/07 ao meio-dia UTC, idx 12).
const marineStrong = fixture('marine-2026-04-30.json'); // ground swell 15.25s/0.90m
const marineMid = fixture('marine-2026-05-02.json'); // transição: 8.30s ao meio-dia
const marineFlat = fixture('marine-2026-07-07.json'); // marulho de verão ~4.25s ao meio-dia
const windStrong = fixture('wind-2026-04-30.json');

const LAT = 38.6788;
const LON = -9.3364;

const okFetch =
  (body: unknown): FetchFn =>
  async () => ({ ok: true, status: 200, json: async () => body });
const statusFetch =
  (status: number): FetchFn =>
  async () => ({ ok: false, status, json: async () => ({ error: true }) });
const throwFetch = (): FetchFn => async () => {
  throw new TypeError('Network request failed');
};

async function caught(promise: Promise<unknown>): Promise<OpenMeteoError> {
  try {
    await promise;
  } catch (error) {
    return error as OpenMeteoError;
  }
  throw new Error('esperava um throw');
}

describe('buildUrl', () => {
  test('marine: parâmetros do §1 verbatim, incl. cell_selection=sea', () => {
    expect(buildMarineUrl(DEFAULT_CONFIG, LAT, LON, '2026-04-30')).toBe(
      'https://marine-api.open-meteo.com/v1/marine?latitude=38.6788&longitude=-9.3364' +
        '&hourly=wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,' +
        'swell_wave_period,swell_wave_peak_period,wind_wave_height,sea_level_height_msl,' +
        'sea_surface_temperature&start_date=2026-04-30&end_date=2026-04-30' +
        '&timeformat=unixtime&timezone=UTC&cell_selection=sea',
    );
  });

  test('wind: parâmetros do §2 verbatim, incl. wind_speed_unit=kmh', () => {
    expect(buildWindUrl(DEFAULT_CONFIG, LAT, LON, '2026-04-30')).toBe(
      'https://api.open-meteo.com/v1/forecast?latitude=38.6788&longitude=-9.3364' +
        '&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m' +
        '&start_date=2026-04-30&end_date=2026-04-30&wind_speed_unit=kmh&timeformat=unixtime&timezone=UTC',
    );
  });

  test('apiKey no config anexa &apikey= (migração comercial = config, não código)', () => {
    const commercial: OpenMeteoConfig = {
      ...DEFAULT_CONFIG,
      marineHost: 'https://customer-marine-api.open-meteo.com',
      apiKey: 'SECRET',
    };
    const url = buildMarineUrl(commercial, LAT, LON, '2026-04-30');
    expect(url.startsWith('https://customer-marine-api.open-meteo.com')).toBe(true);
    expect(url.endsWith('&apikey=SECRET')).toBe(true);
  });
});

describe('parseMarine (dias reais)', () => {
  test('dia forte 30/04: 24 horas; idx 13 tem swell 15.25s / 0.90m no epoch certo', () => {
    const data = parseMarine(marineStrong);
    expect(data).toHaveLength(24);
    expect(data[13]).toMatchObject({
      timeUtc: 1_777_554_000,
      swellPeriodS: 15.25,
      swellHeightM: 0.9,
    });
  });

  test('null-não-zero: um 0 real (wind_wave_height idx 2) fica 0, não null', () => {
    const data = parseMarine(marineStrong);
    expect(data[2].windWaveHeightM).toBe(0);
    expect(data[2].windWaveHeightM).not.toBeNull();
  });

  test('dias intermédio e flat: valores ao meio-dia UTC (idx 12) que foram validados', () => {
    expect(parseMarine(marineMid)[12]).toMatchObject({
      timeUtc: 1_777_723_200, // 2026-05-02T12:00:00Z
      swellPeriodS: 8.3,
      swellHeightM: 0.98,
    });
    expect(parseMarine(marineFlat)[12]).toMatchObject({
      timeUtc: 1_783_425_600, // 2026-07-07T12:00:00Z
      swellPeriodS: 4.25,
      swellHeightM: 0.34,
    });
  });
});

describe('parseWind (dias reais)', () => {
  test('nulls reais: o wind do 30/04 tem idx 0 a null em todas as variáveis', () => {
    const data = parseWind(windStrong);
    expect(data).toHaveLength(24);
    expect(data[0]).toMatchObject({
      windSpeedKmh: null,
      windDirectionDeg: null,
      windGustsKmh: null,
    });
  });
});

describe('createOpenMeteoProvider', () => {
  test('fetchDayConditions chama o fetch com a URL do §1 e devolve os dados parseados', async () => {
    let seen = '';
    const capturing: FetchFn = async (url) => {
      seen = url;
      return { ok: true, status: 200, json: async () => marineStrong };
    };
    const data = await createOpenMeteoProvider(DEFAULT_CONFIG, capturing).fetchDayConditions(
      LAT,
      LON,
      '2026-04-30',
    );
    expect(seen).toBe(buildMarineUrl(DEFAULT_CONFIG, LAT, LON, '2026-04-30'));
    expect(data[13].swellPeriodS).toBe(15.25);
  });

  test('HTTP 400 → OpenMeteoError permanente', async () => {
    const provider = createOpenMeteoProvider(DEFAULT_CONFIG, statusFetch(400));
    const error = await caught(provider.fetchDayConditions(LAT, LON, '2026-04-30'));
    expect(error).toBeInstanceOf(OpenMeteoError);
    expect(error.permanent).toBe(true);
  });

  test('5xx e 429 → temporário', async () => {
    for (const status of [500, 503, 429]) {
      const provider = createOpenMeteoProvider(DEFAULT_CONFIG, statusFetch(status));
      const error = await caught(provider.fetchDayWind(LAT, LON, '2026-04-30'));
      expect(error.permanent).toBe(false);
    }
  });

  test('falha de rede (fetch lança) → temporário', async () => {
    const provider = createOpenMeteoProvider(DEFAULT_CONFIG, throwFetch());
    const error = await caught(provider.fetchDayConditions(LAT, LON, '2026-04-30'));
    expect(error.permanent).toBe(false);
  });

  test('200 sem hourly.time → temporário (D2 corrigida), não permanente', async () => {
    const provider = createOpenMeteoProvider(DEFAULT_CONFIG, okFetch({ hourly: {} }));
    const error = await caught(provider.fetchDayConditions(LAT, LON, '2026-04-30'));
    expect(error).toBeInstanceOf(OpenMeteoError);
    expect(error.permanent).toBe(false);
  });
});
