import { describe, expect, it } from 'vitest';
import { availableSpots, isSpots, latestSpots } from './spots';

describe('cupos', () => {
  it('valida los cupos que envía el servidor', () => {
    expect(isSpots({ capacity: 4, occupied: 1, version: 2 })).toBe(true);
    expect(isSpots(null)).toBe(false);
    expect(isSpots({ capacity: 4, occupied: -1, version: 2 })).toBe(false);
    expect(isSpots({ capacity: 2.5, occupied: 1, version: 2 })).toBe(false);
    expect(isSpots({ capacity: 4, occupied: 1 })).toBe(false);
    expect(isSpots({ occupied: 1, version: 2 })).toBe(false);
    expect(isSpots({ capacity: 4, version: 2 })).toBe(false);
  });

  it('cuenta los que quedan, nunca negativos', () => {
    expect(availableSpots({ capacity: 8, occupied: 5, version: 1 })).toBe(3);
    expect(availableSpots({ capacity: 3, occupied: 4, version: 1 })).toBe(0);
  });
});

describe('latestSpots', () => {
  const loaded = { capacity: 4, occupied: 1, version: 2 };
  const live = { capacity: 4, occupied: 2, version: 3 };

  it('sin avisos en vivo, quedan los cupos cargados', () => {
    expect(latestSpots(loaded, null)).toEqual(loaded);
  });

  it('un aviso más nuevo gana; uno atrasado o repetido no pisa lo cargado', () => {
    expect(latestSpots(loaded, live)).toEqual(live);
    expect(latestSpots(loaded, { ...live, version: 1 })).toEqual(loaded);
    expect(latestSpots(loaded, { ...live, version: 2 })).toEqual(loaded);
  });

  it('devuelve solo los cupos, sin los demás datos del aviso', () => {
    expect(latestSpots(loaded, { ...live, type: 'CUPOS' } as typeof live)).toEqual(live);
  });
});
