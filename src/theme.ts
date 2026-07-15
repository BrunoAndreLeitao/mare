// Tokens do DESIGN.md — Diário de Bordo. Modo escuro não é prioridade no MVP (ver DESIGN.md §Cor).

export const colors = {
  background: '#F7F2E7',
  surface: '#FBF8F0',
  ink: '#16324F',
  inkMuted: '#5C6B73',
  accent: '#C4622D',
  accentOn: '#F7F2E7', // texto sobre fundo accent (chip selecionado, badge)
  success: '#3D6B4F',
  error: '#A33B2E',
  pending: '#8A7A5C',
  hairline: '#DCD3BF',
  starEmpty: '#D9CFB8',
} as const;

export const font = {
  displaySemiBold: 'Fraunces_600SemiBold',
  displayMedium: 'Fraunces_500Medium',
  displayMediumItalic: 'Fraunces_500Medium_Italic',
  body: 'InstrumentSans_400Regular',
  bodySemiBold: 'InstrumentSans_600SemiBold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoSemiBold: 'JetBrainsMono_600SemiBold',
} as const;

export const space = { xs2: 2, xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xl2: 48 } as const;

export const radius = { chip: 999, card: 12, input: 8 } as const;
