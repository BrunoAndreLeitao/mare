import { parseCoordinate, validateCoords } from '../coords';

describe('parseCoordinate', () => {
  it('a) aceita ponto e vírgula decimal', () => {
    expect(parseCoordinate('38.678')).toBe(38.678);
    expect(parseCoordinate('38,678')).toBe(38.678);
    expect(parseCoordinate('-9,336')).toBe(-9.336);
  });

  it('b) faz trim de espaços à volta', () => {
    expect(parseCoordinate('  -9.3364  ')).toBe(-9.3364);
  });

  it('c) rejeita strings vazias ou só com espaços', () => {
    expect(parseCoordinate('')).toBeNull();
    expect(parseCoordinate('   ')).toBeNull();
  });

  it('d) rejeita lixo, incluindo prefixos/sufixos numéricos', () => {
    expect(parseCoordinate('abc')).toBeNull();
    expect(parseCoordinate('abc12')).toBeNull();
    expect(parseCoordinate('12abc')).toBeNull();
    expect(parseCoordinate('1,2,3')).toBeNull();
    expect(parseCoordinate('Infinity')).toBeNull();
  });
});

describe('validateCoords', () => {
  it('a) aceita coordenadas reais (Carcavelos)', () => {
    expect(validateCoords(38.6785, -9.3364)).toBeNull();
  });

  it('b) aceita os limites exatos ±90 / ±180', () => {
    expect(validateCoords(90, 180)).toBeNull();
    expect(validateCoords(-90, -180)).toBeNull();
  });

  it('c) rejeita latitude fora de [-90, 90]', () => {
    expect(validateCoords(90.0001, 0)).toBe('coordsOutOfRange');
    expect(validateCoords(-91, 0)).toBe('coordsOutOfRange');
  });

  it('d) rejeita longitude fora de [-180, 180]', () => {
    expect(validateCoords(0, 180.0001)).toBe('coordsOutOfRange');
    expect(validateCoords(0, -181)).toBe('coordsOutOfRange');
  });

  it('e) rejeita valores não-finitos (NaN, Infinity)', () => {
    expect(validateCoords(NaN, -9.3)).toBe('coordsNotNumeric');
    expect(validateCoords(38.7, Infinity)).toBe('coordsNotNumeric');
    expect(validateCoords(-Infinity, -Infinity)).toBe('coordsNotNumeric');
  });

  it('f) rejeita (0, 0) exato — null island', () => {
    expect(validateCoords(0, 0)).toBe('coordsNullIsland');
  });

  it('g) aceita coordenadas perto de zero que não sejam (0, 0) exato', () => {
    expect(validateCoords(0, 0.1)).toBeNull();
    expect(validateCoords(-0.0001, 0)).toBeNull();
  });
});
