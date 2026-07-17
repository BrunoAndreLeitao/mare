import { weekStreak } from '../streak';

// Epochs REAIS em hora local de Portugal (a semana do surfista é a do relógio
// dele), verificados com `TZ=Europe/Lisbon node -e "..."`. Segundas-feiras de
// referência, todas às 10:00 locais.
const SEG_13JUL = 1_783_933_200;
const SEG_06JUL = 1_783_328_400;
const SEG_29JUN = 1_782_723_600;
const SEG_22JUN = 1_782_118_800;

// Quinta 16/07/2026, 10:00 local — dentro da semana de 13/07.
const QUI_16JUL = new Date(1_784_192_400 * 1000);

describe('weekStreak', () => {
  test('sem sessões → 0', () => {
    expect(weekStreak([], QUI_16JUL)).toBe(0);
  });

  test('conta semanas consecutivas até à semana atual', () => {
    expect(weekStreak([SEG_13JUL, SEG_06JUL, SEG_29JUN], QUI_16JUL)).toBe(3);
  });

  test('para no primeiro buraco (a semana de 06/07 falta)', () => {
    expect(weekStreak([SEG_13JUL, SEG_29JUN], QUI_16JUL)).toBe(1);
  });

  test('várias sessões na mesma semana contam uma vez', () => {
    expect(weekStreak([SEG_13JUL, SEG_13JUL + 86_400, SEG_06JUL], QUI_16JUL)).toBe(2);
  });

  test('a semana ATUAL sem sessões não parte a streak (ainda não acabou)', () => {
    // Segunda de manhã, sem surfar esta semana: a streak das 2 anteriores mantém-se.
    expect(weekStreak([SEG_06JUL, SEG_29JUN], QUI_16JUL)).toBe(2);
  });

  test('a semana ANTERIOR sem sessões parte a streak (essa já acabou)', () => {
    // Última sessão há 2+ semanas: a semana de 06/07 passou em branco.
    expect(weekStreak([SEG_29JUN, SEG_22JUN], QUI_16JUL)).toBe(0);
  });

  // Epochs REAIS (TZ=Europe/Lisbon), com a mudança de hora no meio:
  //   23/03 10:00 → 1774260000 · 30/03 10:00 → 1774861200 (167h de intervalo!)
  //   19/10 10:00 → 1792400400 · 26/10 10:00 → 1793008800 (169h)
  // Se a aritmética de semanas usar 7*24h cegamente, a chave desalinha-se aqui.
  test('a mudança WET/WEST não parte a streak', () => {
    const QUI_02ABR = new Date(1_775_120_400 * 1000);
    expect(weekStreak([1_774_861_200, 1_774_260_000], QUI_02ABR)).toBe(2);

    const QUI_29OUT = new Date(1_793_268_000 * 1000);
    expect(weekStreak([1_793_008_800, 1_792_400_400], QUI_29OUT)).toBe(2);
  });
});
