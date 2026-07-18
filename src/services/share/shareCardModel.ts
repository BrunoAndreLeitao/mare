import { type SessionConditions, type SessionListItem } from '../../db/types';
import { t } from '../../i18n';
import { degToCardinal } from '../../utils/directions';

// Modelo puro do cartão de partilha: decide O QUE aparece, sem JSX nem nativo.
// O cartão de partilha OMITE ausências (ao contrário do detalhe, que mostra
// "—"): uma imagem para partilhar não deve exibir buracos.
export interface ShareCardModel {
  spotName: string;
  startedAt: number;
  rating: number;
  meta: string[]; // prancha, duração — só os que existem
  hero: { swell: string; period: string } | null; // null se pending/sem swell
  context: string | null; // vento + maré, o que houver; null se nada
}

export function buildShareCardModel(
  session: SessionListItem,
  conditions: SessionConditions | null,
): ShareCardModel {
  const meta = [
    session.boardName,
    session.durationMin !== null ? `${session.durationMin} min` : null,
  ].filter((x): x is string => x !== null);

  // Hero só com swell E período reais (a leitura discriminante do spot). Sem
  // conditions (pending) ou sem swell, não há hero — não se inventa.
  const hero =
    conditions !== null && conditions.swellHeightM !== null && conditions.swellPeriodS !== null
      ? { swell: `${conditions.swellHeightM} m`, period: `${conditions.swellPeriodS} s` }
      : null;

  // Contexto: vento (com direção cardeal se houver) e/ou maré, juntos por "·".
  let context: string | null = null;
  if (conditions !== null) {
    const parts: string[] = [];
    if (conditions.windSpeedKmh !== null) {
      const dir = conditions.windDirectionDeg !== null ? ` ${degToCardinal(conditions.windDirectionDeg)}` : '';
      parts.push(`${conditions.windSpeedKmh} km/h${dir}`);
    }
    if (conditions.tidePhase !== null) {
      parts.push(t.sessions.tide[conditions.tidePhase]);
    }
    context = parts.length > 0 ? parts.join(' · ') : null;
  }

  return {
    spotName: session.spotName,
    startedAt: session.startedAt,
    rating: session.rating,
    meta,
    hero,
    context,
  };
}
