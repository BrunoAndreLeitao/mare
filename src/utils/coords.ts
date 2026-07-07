// Validação de coordenadas (Fase 1, Tarefa 3).
// As chaves de erro correspondem a t.spots no src/i18n — a UI faz t.spots[err].
export type CoordsError =
  | 'coordsNotNumeric'
  | 'coordsOutOfRange'
  | 'coordsNullIsland';

// Parser decimal genérico (coordenadas, volume, …): trim, vírgula decimal →
// ponto, Number() em vez de parseFloat ('abc12' e '12abc' dão NaN → null, não
// um prefixo). A validação de domínio é a jusante, de cada chamador
// (validateCoords para coordenadas, > 0 para volume).
export function parseDecimal(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  if (normalized === '') return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function validateCoords(lat: number, lon: number): CoordsError | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return 'coordsNotNumeric';
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return 'coordsOutOfRange';
  if (lat === 0 && lon === 0) return 'coordsNullIsland';
  return null;
}
