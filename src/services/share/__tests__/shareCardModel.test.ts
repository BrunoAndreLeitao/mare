import { type SessionConditions, type SessionListItem } from '../../../db/types';
import { buildShareCardModel } from '../shareCardModel';

function session(over: Partial<SessionListItem> = {}): SessionListItem {
  return {
    id: 's1', spotId: 'spot-1', boardId: null, startedAt: 1_700_000_000,
    durationMin: null, rating: 4, crowd: null, notes: null, createdAt: 1, updatedAt: 1,
    spotName: 'Carcavelos', boardName: null, swellHeightM: null, swellPeriodS: null,
    windSpeedKmh: null, windDirectionDeg: null, tidePhase: null, fetchStatus: 'ok',
    ...over,
  };
}

function conditions(over: Partial<SessionConditions> = {}): SessionConditions {
  return {
    sessionId: 's1', waveHeightM: null, waveDirectionDeg: null, wavePeriodS: null,
    swellHeightM: null, swellDirectionDeg: null, swellPeriodS: null, swellPeakPeriodS: null,
    windWaveHeightM: null, seaLevelMslM: null, tidePhase: null, waterTempC: null,
    windSpeedKmh: null, windGustsKmh: null, windDirectionDeg: null, windRelation: null,
    fetchStatus: 'ok', retryCount: 0, fetchedAt: null, source: 'open-meteo', rawJson: null,
    ...over,
  };
}

describe('buildShareCardModel', () => {
  test('sessão completa: hero + contexto + meta', () => {
    const m = buildShareCardModel(
      session({ boardName: '6\'2 Lost', durationMin: 55 }),
      conditions({ swellHeightM: 1.2, swellPeriodS: 15, windSpeedKmh: 16, windDirectionDeg: 0, tidePhase: 'falling' }),
    );
    expect(m.spotName).toBe('Carcavelos');
    expect(m.rating).toBe(4);
    expect(m.meta).toEqual(['6\'2 Lost', '55 min']);
    expect(m.hero).toEqual({ swell: '1.2 m', period: '15 s' });
    expect(m.context).toBe('16 km/h N · a vazar');
  });

  test('pending (sem conditions) → hero e contexto null, mas meta e cabeçalho ficam', () => {
    const m = buildShareCardModel(session({ boardName: 'Fish', fetchStatus: 'pending' }), null);
    expect(m.hero).toBeNull();
    expect(m.context).toBeNull();
    expect(m.meta).toEqual(['Fish']);
    expect(m.spotName).toBe('Carcavelos');
  });

  test('ok mas sem swell → hero null (não inventa)', () => {
    const m = buildShareCardModel(session(), conditions({ windSpeedKmh: 10, windDirectionDeg: 90 }));
    expect(m.hero).toBeNull();
    expect(m.context).toBe('10 km/h E');
  });

  test('meta vazia quando não há prancha nem duração', () => {
    expect(buildShareCardModel(session(), null).meta).toEqual([]);
  });

  test('contexto parcial: só vento (sem maré) e só maré (sem vento)', () => {
    expect(buildShareCardModel(session(), conditions({ windSpeedKmh: 20, windDirectionDeg: 180 })).context).toBe('20 km/h S');
    expect(buildShareCardModel(session(), conditions({ tidePhase: 'rising' })).context).toBe('a encher');
  });

  test('vento sem direção → só a velocidade', () => {
    expect(buildShareCardModel(session(), conditions({ windSpeedKmh: 12 })).context).toBe('12 km/h');
  });
});
