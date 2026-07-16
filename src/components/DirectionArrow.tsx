import { Ionicons } from '@expo/vector-icons';

import { type TidePhase } from '../db/types';
import { bearingToArrowRotation } from '../utils/directions';
import { useTheme } from '../theme';

// Seta que aponta para onde o vento/swell VAI (o rumo da API é de onde vem —
// ver bearingToArrowRotation). Acompanha o valor em texto, não o substitui.
export function DirectionArrow({
  deg,
  size = 12,
  color,
}: {
  deg: number;
  size?: number;
  color?: string;
}) {
  const theme = useTheme();
  return (
    <Ionicons
      name="arrow-up"
      size={size}
      color={color ?? theme.colors.inkMuted}
      style={{ transform: [{ rotate: `${bearingToArrowRotation(deg)}deg` }] }}
    />
  );
}

const TIDE_ICONS: Record<TidePhase, 'arrow-up' | 'arrow-down' | 'remove'> = {
  rising: 'arrow-up',
  falling: 'arrow-down',
  high: 'remove', // traço = pico (nem sobe nem desce)
  low: 'remove',
};

export function TideIcon({
  phase,
  size = 12,
  color,
}: {
  phase: TidePhase;
  size?: number;
  color?: string;
}) {
  const theme = useTheme();
  return <Ionicons name={TIDE_ICONS[phase]} size={size} color={color ?? theme.colors.inkMuted} />;
}
