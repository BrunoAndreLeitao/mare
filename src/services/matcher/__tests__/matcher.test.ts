import { readFileSync } from 'fs';
import { join } from 'path';

import { parseMarine, parseWind } from '../../openmeteo/provider';
import { buildSnapshot, closestHourIndex, deriveTidePhase } from '../matcher';

// Epochs UTC verificáveis: 2026-01-01T00:00Z = 1_767_225_600.
const MAR29 = 1_774_742_400; // 2026-03-29T00:00Z — springforward WET→WEST às 01:00 UTC
const OCT25 = 1_792_886_400; // 2026-10-25T00:00Z — fallback WEST→WET
const day = (base: number) => Array.from({ length: 24 }, (_, i) => base + i * 3_600);

describe('closestHourIndex', () => {
  test('(a) XX:29 → hora anterior; XX:31 → hora seguinte (obrigatório §3)', () => {
    const times = day(MAR29);
    expect(closestHourIndex(times, MAR29 + 10 * 3_600 + 29 * 60)).toBe(10);
    expect(closestHourIndex(times, MAR29 + 10 * 3_600 + 31 * 60)).toBe(11);
  });

  test('(b) empate exato XX:30:00 → anterior, por regra explícita (prova: array desordenado)', () => {
    expect(closestHourIndex(day(MAR29), MAR29 + 10 * 3_600 + 30 * 60)).toBe(10);
    // Desordenado: a hora mais tardia vem primeiro. A regra times[i] < times[best]
    // tem de escolher a hora ANTERIOR (idx 1), não a primeiro-vista.
    const unsorted = [MAR29 + 3_600, MAR29];
    expect(closestHourIndex(unsorted, MAR29 + 30 * 60)).toBe(1);
  });

  test('(c) fronteiras WET/WEST: aritmética UTC pura, imune à mudança de hora local', () => {
    // Springforward (março): 01:00 UTC local salta 01:00→02:00 WEST. Sessões
    // às 01:29/01:31 UTC casam 01:00/02:00 UTC — o fuso local é irrelevante.
    const march = day(MAR29);
    expect(closestHourIndex(march, MAR29 + 3_600 + 29 * 60)).toBe(1);
    expect(closestHourIndex(march, MAR29 + 3_600 + 31 * 60)).toBe(2);
    // Fallback (outubro): a hora local 01:xx existe duas vezes; em UTC não.
    const october = day(OCT25);
    expect(closestHourIndex(october, OCT25 + 3_600 + 30 * 60)).toBe(1); // empate → anterior
    expect(closestHourIndex(october, OCT25 + 2 * 3_600 + 31 * 60)).toBe(3);
  });

  test('(d) |delta| > 5400s (dia errado da API) e array vazio → null', () => {
    expect(closestHourIndex(day(MAR29), MAR29 + 26 * 3_600)).toBeNull(); // 2h além do fim
    expect(closestHourIndex([], MAR29)).toBeNull();
    // Fronteira exata: 5400s ainda casa.
    expect(closestHourIndex([MAR29], MAR29 + 5_400)).toBe(0);
    expect(closestHourIndex([MAR29], MAR29 + 5_401)).toBeNull();
  });
});

describe('deriveTidePhase', () => {
  const levels = [0.2, 0.5, 0.7, 0.6, 0.3, 0.1, 0.2];

  test('(e) interior: pico → high, cava → low, a subir → rising, a descer → falling', () => {
    expect(deriveTidePhase(levels, 2)).toBe('high'); // 0.5 < 0.7 > 0.6
    expect(deriveTidePhase(levels, 5)).toBe('low'); // 0.3 > 0.1 < 0.2
    expect(deriveTidePhase(levels, 1)).toBe('rising'); // 0.7 > 0.5
    expect(deriveTidePhase(levels, 3)).toBe('falling'); // 0.3 < 0.6
  });

  test('(f) bordos (idx 0 e último) → null por decisão: etiqueta parcial seria errada, não incompleta', () => {
    expect(deriveTidePhase(levels, 0)).toBeNull();
    expect(deriveTidePhase(levels, levels.length - 1)).toBeNull();
  });

  test('(g) vizinho null → null (o valor bruto grava-se na mesma, a montante)', () => {
    expect(deriveTidePhase([0.2, 0.5, null], 1)).toBeNull();
    expect(deriveTidePhase([null, 0.5, 0.7], 1)).toBeNull();
    expect(deriveTidePhase([0.2, null, 0.7], 1)).toBeNull();
  });
});

describe('buildSnapshot', () => {
  const fixture = (name: string): unknown =>
    JSON.parse(
      readFileSync(join(__dirname, '..', '..', 'openmeteo', '__tests__', 'fixtures', name), 'utf8'),
    );
  const marine = parseMarine(fixture('marine-2026-04-30.json'));
  const wind = parseWind(fixture('wind-2026-04-30.json'));

  test('(h) fixture real 30/04: sessão às 13:20 UTC casa idx 13 — swell 15.25s/0.90m e preia-mar real', () => {
    const snapshot = buildSnapshot(marine, wind, 1_777_555_200); // 13:20:00Z
    expect(snapshot).toMatchObject({
      matchedTimeUtc: 1_777_554_000, // 13:00:00Z
      swellPeriodS: 15.25,
      swellHeightM: 0.9,
      waveHeightM: 1.34,
      waterTempC: 16.4,
      seaLevelMslM: 0.81,
      tidePhase: 'high', // sea_level real: 0.57 → 0.81 → 0.74 (pico às 13:00)
      source: 'open-meteo',
    });
    // O wind desta fixture é null às 13:00 (data fora da janela da Forecast
    // API) — dado real a exercitar o "grava-se o que há".
    expect(snapshot!.windSpeedKmh).toBeNull();
  });

  test('(i) wind fora de janela → campos wind null, resto do snapshot fica', () => {
    const snapshot = buildSnapshot(marine, [], 1_777_555_200);
    expect(snapshot).toMatchObject({
      matchedTimeUtc: 1_777_554_000,
      swellPeriodS: 15.25,
      windSpeedKmh: null,
      windGustsKmh: null,
      windDirectionDeg: null,
    });
  });

  test('(j) marine fora de janela → null (sem âncora de hora não há snapshot)', () => {
    const nextDay = 1_777_554_000 + 24 * 3_600;
    expect(buildSnapshot(marine, wind, nextDay + 2 * 3_600)).toBeNull();
    expect(buildSnapshot([], wind, 1_777_555_200)).toBeNull();
  });
});
