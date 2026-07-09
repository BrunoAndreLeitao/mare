import { type ConditionsRepository } from '../../db/repositories/conditionsRepo';
import { type ConditionValues } from '../../db/types';
import {
  buildSnapshot,
  closestHourIndex,
  type SessionConditionsSnapshot,
} from '../matcher/matcher';
import { OpenMeteoError } from './provider';
import {
  type HourlyMarineData,
  type HourlyWindData,
  type MarineDataProvider,
} from './types';

// Worker da fila de pendentes (docs/OPEN_METEO.md §6): pura COMPOSIÇÃO de
// listFetchable → provider → buildSnapshot → saveSnapshot/markFailed. Tudo
// injetado — zero imports de expo/netinfo; os triggers reais ligam-se no ponto
// de composição (Tarefa 8), incluindo a guarda de reentrância.
export interface PendingQueueDeps {
  conditions: ConditionsRepository;
  provider: MarineDataProvider;
  isOnline(): Promise<boolean>;
  sleep(ms: number): Promise<void>;
}

export interface QueueRunResult {
  processed: number;
  ok: number;
  partial: number;
  failed: number;
}

export const QUEUE_LIMIT = 10;
export const PACING_MS = 300; // §6: rajadas agressivas são má cidadania

function toDateUtc(epoch: number): string {
  return new Date(epoch * 1000).toISOString().slice(0, 10);
}

// §7 com gralha corrigida: AMBAS as coords arredondadas a 2 casas (o doc só
// escreve a lat, leitura assimétrica sem sentido). A 38°N, 0.01° são ≈1.11 km
// em latitude e ≈0.87 km em longitude — células próximas disto na grelha da API.
function cacheKey(lat: number, lon: number, date: string): string {
  return `${lat.toFixed(2)}|${lon.toFixed(2)}|${date}`;
}

// Só sucessos entram na cache: um throw não chega ao set, e a sessão seguinte
// do mesmo dia volta a tentar.
async function cached<T>(cache: Map<string, T>, key: string, fetchDay: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const value = await fetchDay();
  cache.set(key, value);
  return value;
}

// Cola nº1 (mapeamento, não lógica): snapshot → ConditionValues da metade
// marine. Os campos wind ficam AUSENTES (undefined), não null — escrever null
// aqui apagaria um wind gravado por um parcial anterior (idempotência por
// coluna do saveSnapshot). raw_json = o slice da hora usada (§Regras 5).
function marineValues(snapshot: SessionConditionsSnapshot): ConditionValues {
  return {
    waveHeightM: snapshot.waveHeightM,
    waveDirectionDeg: snapshot.waveDirectionDeg,
    wavePeriodS: snapshot.wavePeriodS,
    swellHeightM: snapshot.swellHeightM,
    swellDirectionDeg: snapshot.swellDirectionDeg,
    swellPeriodS: snapshot.swellPeriodS,
    swellPeakPeriodS: snapshot.swellPeakPeriodS,
    windWaveHeightM: snapshot.windWaveHeightM,
    seaLevelMslM: snapshot.seaLevelMslM,
    tidePhase: snapshot.tidePhase,
    waterTempC: snapshot.waterTempC,
    rawJson: JSON.stringify(snapshot),
  };
}

function fullValues(snapshot: SessionConditionsSnapshot): ConditionValues {
  return {
    ...marineValues(snapshot),
    windSpeedKmh: snapshot.windSpeedKmh,
    windGustsKmh: snapshot.windGustsKmh,
    windDirectionDeg: snapshot.windDirectionDeg,
  };
}

// Cola nº2: parcial wind-only. O buildSnapshot exige marine como âncora, por
// isso este caminho casa a hora nos tempos do PRÓPRIO wind via closestHourIndex
// — a única aritmética de tempo direta do worker.
function windOnlyValues(wind: HourlyWindData[], startedAtUtc: number): ConditionValues | null {
  const idx = closestHourIndex(
    wind.map((h) => h.timeUtc),
    startedAtUtc,
  );
  if (idx === null) return null;
  const w = wind[idx];
  return {
    windSpeedKmh: w.windSpeedKmh,
    windGustsKmh: w.windGustsKmh,
    windDirectionDeg: w.windDirectionDeg,
  };
}

function isPermanent(error: unknown): boolean {
  return error instanceof OpenMeteoError && error.permanent;
}

interface Caches {
  marine: Map<string, HourlyMarineData[]>;
  wind: Map<string, HourlyWindData[]>;
}

async function processOne(
  deps: PendingQueueDeps,
  item: { sessionId: string; latitude: number; longitude: number; startedAtUtc: number },
  caches: Caches,
  result: QueueRunResult,
): Promise<void> {
  const date = toDateUtc(item.startedAtUtc);
  const key = cacheKey(item.latitude, item.longitude, date);

  const [marineRes, windRes] = await Promise.allSettled([
    cached(caches.marine, key, () =>
      deps.provider.fetchDayConditions(item.latitude, item.longitude, date),
    ),
    cached(caches.wind, key, () => deps.provider.fetchDayWind(item.latitude, item.longitude, date)),
  ]);

  if (marineRes.status === 'fulfilled' && windRes.status === 'fulfilled') {
    const snapshot = buildSnapshot(marineRes.value, windRes.value, item.startedAtUtc);
    if (snapshot === null) {
      // Dia errado (§3, delta > 5400s): bug nosso. Não-permanente de propósito:
      // corrigido o bug num update, as sessões auto-recuperam no retry.
      await deps.conditions.markFailed(item.sessionId, false);
      result.failed++;
      return;
    }
    await deps.conditions.saveSnapshot(item.sessionId, fullValues(snapshot));
    result.ok++;
    return;
  }

  if (marineRes.status === 'fulfilled') {
    // Parcial marine-only: contrato do conditionsRepo — saveSnapshot(parcial)
    // e DEPOIS markFailed(false), por esta ordem.
    const snapshot = buildSnapshot(marineRes.value, [], item.startedAtUtc);
    if (snapshot === null) {
      await deps.conditions.markFailed(item.sessionId, false);
      result.failed++;
      return;
    }
    await deps.conditions.saveSnapshot(item.sessionId, marineValues(snapshot));
    await deps.conditions.markFailed(item.sessionId, false);
    result.partial++;
    return;
  }

  if (windRes.status === 'fulfilled') {
    const values = windOnlyValues(windRes.value, item.startedAtUtc);
    if (values === null) {
      await deps.conditions.markFailed(item.sessionId, false);
      result.failed++;
      return;
    }
    await deps.conditions.saveSnapshot(item.sessionId, values);
    await deps.conditions.markFailed(item.sessionId, false);
    result.partial++;
    return;
  }

  // Ambos falharam. Permanente só se AMBOS forem irrecuperáveis (AND): com um
  // OR, marine 400 + wind timeout enterraria PARA SEMPRE um vento recuperável.
  // Um retry desperdiçado é barato; dado perdido em silêncio é o produto a
  // falhar. O teto de 5 limita o desperdício.
  const permanent = isPermanent(marineRes.reason) && isPermanent(windRes.reason);
  await deps.conditions.markFailed(item.sessionId, permanent);
  result.failed++;
}

export async function processPendingQueue(deps: PendingQueueDeps): Promise<QueueRunResult> {
  const result: QueueRunResult = { processed: 0, ok: 0, partial: 0, failed: 0 };
  // Verificado uma vez: offline → retorno imediato; os triggers do §6 é que
  // re-invocam o worker, não é o worker que espera pela rede.
  if (!(await deps.isOnline())) return result;

  const queue = await deps.conditions.listFetchable(QUEUE_LIMIT);
  const caches: Caches = { marine: new Map(), wind: new Map() };

  for (let i = 0; i < queue.length; i++) {
    if (i > 0) await deps.sleep(PACING_MS); // entre sessões, não após a última
    result.processed++;
    await processOne(deps, queue[i], caches, result);
  }
  return result;
}
