import { degToCardinal } from '../directions';

describe('degToCardinal', () => {
  it('a) 8 setores de 45° com fronteiras corretas e wrap-around', () => {
    expect(degToCardinal(0)).toBe('N');
    expect(degToCardinal(22.4)).toBe('N'); // ainda dentro do setor N
    expect(degToCardinal(22.5)).toBe('NE'); // fronteira exata muda de setor
    expect(degToCardinal(90)).toBe('E');
    expect(degToCardinal(180)).toBe('S');
    expect(degToCardinal(270)).toBe('O');
    expect(degToCardinal(322)).toBe('NO'); // o vento do smoke E2E
    expect(degToCardinal(337.5)).toBe('N'); // wrap: fim do setor NO
    expect(degToCardinal(360)).toBe('N');
    expect(degToCardinal(-45)).toBe('NO'); // negativos normalizam
  });
});
