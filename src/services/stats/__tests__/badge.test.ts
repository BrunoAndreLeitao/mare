import { type SessionListItem } from '../../../db/types';
import { swellVsAverage } from '../badge';

// Fábrica mínima: só os campos que o cálculo lê.
function session(id: string, swellHeightM: number | null, ok = true): SessionListItem {
  return {
    id,
    spotId: 'spot-1',
    boardId: null,
    startedAt: 1_000,
    durationMin: null,
    rating: 4,
    crowd: null,
    notes: null,
    createdAt: 1,
    updatedAt: 1,
    spotName: 'Carcavelos',
    boardName: null,
    swellHeightM,
    swellPeriodS: null,
    windSpeedKmh: null,
    windDirectionDeg: null,
    tidePhase: null,
    fetchStatus: ok ? 'ok' : 'pending',
  };
}

// 10 sessões ok de 1.0 m: média das OUTRAS = 1.0 exatamente.
const tenAtOne = Array.from({ length: 10 }, (_, i) => session(`s${i}`, 1.0));

describe('swellVsAverage', () => {
  test('fronteira: 9 sessões ok no spot → sem badge', () => {
    const nine = tenAtOne.slice(0, 9);
    const s = session('alvo', 2.0);
    expect(swellVsAverage(s, [...nine, s])).toBeNull(); // 9 outras + a própria
  });

  test('fronteira: 10 sessões ok no spot → com badge', () => {
    const s = session('alvo', 2.0);
    // 10 outras a 1.0 + a própria a 2.0 → +100%
    expect(swellVsAverage(s, [...tenAtOne, s])).toBe(100);
  });

  test('a própria sessão não entra na média', () => {
    // Se entrasse, a média seria (10*1.0 + 3.0)/11 = 1.18 → +154%.
    // Excluída: média = 1.0 → +200%.
    const s = session('alvo', 3.0);
    expect(swellVsAverage(s, [...tenAtOne, s])).toBe(200);
  });

  test('swell abaixo da média → null (o badge só celebra)', () => {
    const s = session('alvo', 0.5);
    expect(swellVsAverage(s, [...tenAtOne, s])).toBeNull();
  });

  test('swell igual à média → null (0% não é notícia)', () => {
    const s = session('alvo', 1.0);
    expect(swellVsAverage(s, [...tenAtOne, s])).toBeNull();
  });

  test('sessões pending/failed não contam para a amostra nem para a média', () => {
    const s = session('alvo', 2.0);
    // 9 ok + 5 pending: a amostra ok é 9 → sem badge, apesar de 14 sessões.
    const pendings = Array.from({ length: 5 }, (_, i) => session(`p${i}`, null, false));
    expect(swellVsAverage(s, [...tenAtOne.slice(0, 9), ...pendings, s])).toBeNull();
  });

  test('sessão sem swell (ou não-ok) não tem badge', () => {
    const semSwell = session('alvo', null);
    expect(swellVsAverage(semSwell, [...tenAtOne, semSwell])).toBeNull();

    const pending = session('alvo', 2.0, false);
    expect(swellVsAverage(pending, [...tenAtOne, pending])).toBeNull();
  });

  test('arredonda ao inteiro', () => {
    const s = session('alvo', 1.7); // +70%
    expect(swellVsAverage(s, [...tenAtOne, s])).toBe(70);
  });
});
