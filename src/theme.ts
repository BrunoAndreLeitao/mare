import { useColorScheme } from 'react-native';

// Dois temas do DESIGN.md + README: claro "Caderno de bordo" (papel quente,
// tinta azul-marinho, acento laranja) e escuro "Carta Náutica" (fundo de
// carta, acento azul). DECISÃO EXPLÍCITA DO UTILIZADOR: os temas têm
// tipografias DIFERENTES (Fraunces/Instrument/JetBrains vs Spectral/Archivo)
// — foi escolha dele no mockup, com o custo da troca de identidade aceite.
// Por isso os tokens de fonte são PAPÉIS (display/body/mono), não famílias.
export interface Theme {
  colors: {
    background: string;
    surface: string;
    ink: string;
    inkMuted: string;
    accent: string;
    accentOn: string; // texto sobre fundo accent (chip selecionado, badge)
    accentSoft: string; // fundos suaves (barras, pills)
    success: string;
    error: string;
    pending: string;
    hairline: string;
    hairlineStrong: string; // contornos de chips/inputs (mais forte que dividers)
    starEmpty: string;
  };
  font: {
    display: string;
    displayItalic: string;
    displaySemiBold: string;
    body: string;
    bodySemiBold: string;
    mono: string;
    monoMedium: string;
    monoSemiBold: string;
  };
}

export const lightTheme: Theme = {
  colors: {
    background: '#F7F2E7',
    surface: '#FBF8F0',
    ink: '#16324F',
    inkMuted: '#5C6B73',
    accent: '#C4622D',
    accentOn: '#F7F2E7',
    accentSoft: '#EAE1CC',
    success: '#3D6B4F',
    error: '#A33B2E',
    pending: '#8A7A5C',
    hairline: '#DCD3BF',
    hairlineStrong: '#C9BE9F',
    starEmpty: '#D9CFB8',
  },
  font: {
    display: 'Fraunces_500Medium',
    displayItalic: 'Fraunces_500Medium_Italic',
    displaySemiBold: 'Fraunces_600SemiBold',
    body: 'InstrumentSans_400Regular',
    bodySemiBold: 'InstrumentSans_600SemiBold',
    mono: 'JetBrainsMono_400Regular',
    monoMedium: 'JetBrainsMono_500Medium',
    monoSemiBold: 'JetBrainsMono_600SemiBold',
  },
};

// Carta Náutica. O escuro não tem monoespaçada própria no README: os papéis
// mono são servidos por Archivo, aceitando a perda de tabular-nums nos
// números do mar (custo assumido da decisão de tipografia por tema).
export const darkTheme: Theme = {
  colors: {
    background: '#14181B',
    surface: '#1C2227',
    ink: '#EDE6D6',
    inkMuted: '#7C8790',
    accent: '#4C7C9C',
    accentOn: '#14181B',
    accentSoft: '#26333C',
    success: '#4C7C9C',
    error: '#C97B4A',
    pending: '#7C8790',
    hairline: '#2C343A',
    hairlineStrong: '#3A424A',
    starEmpty: '#3A424A',
  },
  font: {
    display: 'Spectral_500Medium',
    displayItalic: 'Spectral_500Medium_Italic',
    displaySemiBold: 'Spectral_600SemiBold',
    body: 'Archivo_400Regular',
    bodySemiBold: 'Archivo_600SemiBold',
    mono: 'Archivo_500Medium',
    monoMedium: 'Archivo_600SemiBold',
    monoSemiBold: 'Archivo_700Bold',
  },
};

// Sem preferência persistida (decisão do plano): o telemóvel já sabe se é de
// noite. Se um dia houver override no Perfil, muda-se aqui — os ecrãs não.
export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}

export const space = { xs2: 2, xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xl2: 48 } as const;

export const radius = { chip: 999, card: 12, input: 8 } as const;
