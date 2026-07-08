import { buildSetClause } from '../setClause';

// A small standalone map keeps these tests independent of any repo.
const MAP = { a: 'col_a', b: 'col_b', c: 'col_c' } as const;

describe('buildSetClause', () => {
  test('(a) mapeia só os campos fornecidos, na ordem do columnMap', () => {
    expect(buildSetClause({ a: 1, c: 2 }, MAP)).toEqual({
      clause: 'col_a = ?, col_c = ?',
      params: [1, 2],
    });
  });

  test('(b) mapeia todos os campos por ordem determinística do map', () => {
    expect(buildSetClause({ a: 1, b: 'x', c: 2 }, MAP)).toEqual({
      clause: 'col_a = ?, col_b = ?, col_c = ?',
      params: [1, 'x', 2],
    });
  });

  test('(c) null explícito escreve a coluna com NULL (não a ignora)', () => {
    expect(buildSetClause({ b: null }, MAP)).toEqual({
      clause: 'col_b = ?',
      params: [null],
    });
  });

  test('(d) undefined e changes vazio produzem clause vazia', () => {
    expect(buildSetClause({ a: undefined }, MAP)).toEqual({ clause: '', params: [] });
    expect(buildSetClause({}, MAP)).toEqual({ clause: '', params: [] });
  });
});
