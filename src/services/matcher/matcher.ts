import { type TidePhase } from '../../db/types';
import { type HourlyMarineData, type HourlyWindData } from '../openmeteo/types';

// Pure time logic (docs/OPEN_METEO.md §3, §5, §9): arrays + startedAt in,
// snapshot out. Zero network, zero I/O — the worker (Tarefa 5) orchestrates.

// §9: the matcher's output contract — one matched hour, both halves flattened.
export interface SessionConditionsSnapshot {
  matchedTimeUtc: number;
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
  windSpeedKmh: number | null;
  windGustsKmh: number | null;
  windDirectionDeg: number | null;
  tidePhase: TidePhase | null;
  source: 'open-meteo';
}

/** §3: 90 min — beyond this the API returned the wrong day (our bug, not theirs). */
export const MAX_MATCH_DELTA_S = 5_400;

/**
 * §3: argmin(|times[i] − startedAtUtc|). On an exact tie the EARLIER hour wins
 * (the session mostly happened in it) — enforced by explicit comparison
 * (times[i] < times[best]), not by iteration order, so an unsorted array gives
 * the same answer. |delta| > 5400s or empty array → null (caller marks failed).
 */
export function closestHourIndex(times: number[], startedAtUtc: number): number | null {
  let best = -1;
  let bestDelta = Infinity;
  for (let i = 0; i < times.length; i++) {
    const delta = Math.abs(times[i] - startedAtUtc);
    if (delta < bestDelta || (delta === bestDelta && times[i] < times[best])) {
      best = i;
      bestDelta = delta;
    }
  }
  return best >= 0 && bestDelta <= MAX_MATCH_DELTA_S ? best : null;
}

/**
 * §5: phase from the two neighbours. At the array edges (no h_prev or no
 * h_next) the phase is NULL by decision: with one neighbour a tide peak at the
 * edge hour would be classified rising/falling — not partial information but
 * WRONG information, indistinguishable from a correct label. tide_phase exists
 * to be shown to the user; the raw sea_level_msl_m is ALWAYS saved regardless,
 * so null costs nothing and drops only a misleading label. (Edge sessions,
 * 23:xx/00:xx UTC, are practically nonexistent in Portugal.) Any needed value
 * being null also yields null.
 */
export function deriveTidePhase(
  seaLevels: Array<number | null>,
  idx: number,
): TidePhase | null {
  if (idx <= 0 || idx >= seaLevels.length - 1) return null;
  const hPrev = seaLevels[idx - 1];
  const h = seaLevels[idx];
  const hNext = seaLevels[idx + 1];
  if (hPrev === null || h === null || hNext === null) return null;
  if (h > hPrev && h > hNext) return 'high';
  if (h < hPrev && h < hNext) return 'low';
  return hNext > h ? 'rising' : 'falling';
}

/**
 * Full-success assembly (§9). Each half matches against ITS OWN time array —
 * no index alignment between marine and wind is assumed. Marine out of window
 * → null (no snapshot: matchedTimeUtc and the tide anchor come from marine);
 * wind out of window → wind fields null, the rest stands.
 */
export function buildSnapshot(
  marine: HourlyMarineData[],
  wind: HourlyWindData[],
  startedAtUtc: number,
): SessionConditionsSnapshot | null {
  const mIdx = closestHourIndex(
    marine.map((h) => h.timeUtc),
    startedAtUtc,
  );
  if (mIdx === null) return null;
  const m = marine[mIdx];

  const wIdx = closestHourIndex(
    wind.map((h) => h.timeUtc),
    startedAtUtc,
  );
  const w = wIdx === null ? null : wind[wIdx];

  return {
    matchedTimeUtc: m.timeUtc,
    waveHeightM: m.waveHeightM,
    waveDirectionDeg: m.waveDirectionDeg,
    wavePeriodS: m.wavePeriodS,
    swellHeightM: m.swellHeightM,
    swellDirectionDeg: m.swellDirectionDeg,
    swellPeriodS: m.swellPeriodS,
    swellPeakPeriodS: m.swellPeakPeriodS,
    windWaveHeightM: m.windWaveHeightM,
    seaLevelMslM: m.seaLevelMslM,
    waterTempC: m.waterTempC,
    windSpeedKmh: w?.windSpeedKmh ?? null,
    windGustsKmh: w?.windGustsKmh ?? null,
    windDirectionDeg: w?.windDirectionDeg ?? null,
    tidePhase: deriveTidePhase(
      marine.map((h) => h.seaLevelMslM),
      mIdx,
    ),
    source: 'open-meteo',
  };
}
