import { type SessionListItem } from '../../db/types';

// Amostra mínima para uma média significar alguma coisa. Com menos, o badge
// não aparece — comparar-se com 3 sessões é ruído, não sinal.
const MIN_SAMPLE = 10;

/**
 * Quanto o swell desta sessão bate a média das OUTRAS sessões do mesmo spot,
 * em % inteira. null quando não há badge a mostrar: amostra < 10 ok, sessão
 * sem swell ok, ou percentagem não-positiva (o badge só celebra).
 */
export function swellVsAverage(
  session: SessionListItem,
  spotSessions: SessionListItem[],
): number | null {
  if (session.fetchStatus !== 'ok' || session.swellHeightM === null) {
    return null;
  }

  // A própria sessão sai da média: senão comparava-se consigo mesma e
  // qualquer sessão puxaria a média na sua própria direção.
  const others = spotSessions.filter(
    (s) => s.id !== session.id && s.fetchStatus === 'ok' && s.swellHeightM !== null,
  );
  if (others.length < MIN_SAMPLE) {
    return null;
  }

  const avg = others.reduce((sum, s) => sum + (s.swellHeightM ?? 0), 0) / others.length;
  if (avg <= 0) {
    return null; // média zero: divisão sem significado
  }

  const pct = Math.round(((session.swellHeightM - avg) / avg) * 100);
  return pct > 0 ? pct : null;
}
