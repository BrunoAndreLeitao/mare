import { bearingToArrowRotation, degToCardinal } from '../directions';

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

describe('bearingToArrowRotation', () => {
  // A Open-Meteo dá direção METEOROLÓGICA — "de onde vem" (322° = vem de NO).
  // Uma seta apontada a 322° apontaria PARA NO, ao contrário do vento real.
  // A rotação da seta é sempre o inverso: +180°.
  test('inverte o rumo para a seta apontar para onde o vento vai', () => {
    expect(bearingToArrowRotation(0)).toBe(180); // vem de N → seta aponta para S
    expect(bearingToArrowRotation(90)).toBe(270); // vem de E → aponta para O
    expect(bearingToArrowRotation(322)).toBe(142); // vem de NO → aponta para SE
  });

  test('normaliza o resultado a [0, 360)', () => {
    expect(bearingToArrowRotation(180)).toBe(0); // 360 → 0, nunca 360
    expect(bearingToArrowRotation(270)).toBe(90);
    expect(bearingToArrowRotation(359)).toBe(179);
  });

  test('aceita rumos fora do intervalo sem partir (defensivo: dados de API)', () => {
    expect(bearingToArrowRotation(-90)).toBe(90);
    expect(bearingToArrowRotation(450)).toBe(270); // 450 ≡ 90 → 270
  });

  // Âncora de coerência: a seta e o cardeal descrevem o mesmo vento.
  test('coerente com degToCardinal no mesmo rumo', () => {
    expect(degToCardinal(322)).toBe('NO');
    expect(bearingToArrowRotation(322)).toBe(142); // SE, o oposto de NO
  });
});
