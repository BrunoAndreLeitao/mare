const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'] as const;

// 8 setores de 45° centrados nos pontos cardeais (0° = N, convenção
// meteorológica "de onde vem"). 322° → NO.
export function degToCardinal(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  return CARDINALS[Math.floor(((normalized + 22.5) % 360) / 45)];
}

// A Open-Meteo dá direção meteorológica: o rumo DE ONDE o vento/swell vem
// (322° = vem de NO). Uma seta desenhada a apontar 322° apontaria PARA NO —
// ao contrário do movimento real. A seta mostra para onde vai: rumo + 180°.
export function bearingToArrowRotation(deg: number): number {
  return (((deg + 180) % 360) + 360) % 360;
}
