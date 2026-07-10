const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'] as const;

// 8 setores de 45° centrados nos pontos cardeais (0° = N, convenção
// meteorológica "de onde vem"). 322° → NO.
export function degToCardinal(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  return CARDINALS[Math.floor(((normalized + 22.5) % 360) / 45)];
}
