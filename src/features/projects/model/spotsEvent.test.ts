import { describe, expect, it } from 'vitest';
import { isSpotsEvent, latestSpots, projectTopic } from './spotsEvent';

const EVENT = { type: 'CUPOS', projectId: 'p-1', capacity: 4, occupied: 2, version: 3 };

describe('canal de cupos', () => {
  it('codifica la convocatoria en el canal', () => {
    expect(projectTopic('p-1')).toBe('/topic/proyectos/p-1/cupos');
    expect(projectTopic('a/b')).toBe('/topic/proyectos/a%2Fb/cupos');
  });

  it('valida el aviso de cupos', () => {
    expect(isSpotsEvent(EVENT)).toBe(true);
    expect(isSpotsEvent(null)).toBe(false);
    expect(isSpotsEvent({ ...EVENT, type: 'OTRO' })).toBe(false);
    expect(isSpotsEvent({ ...EVENT, projectId: 1 })).toBe(false);
    expect(isSpotsEvent({ ...EVENT, occupied: '2' })).toBe(false);
  });
});

describe('latestSpots', () => {
  const loaded = { capacity: 4, occupied: 1, version: 2 };

  it('sin avisos en vivo, quedan los cupos cargados', () => {
    expect(latestSpots(loaded, null)).toEqual(loaded);
  });

  it('un aviso más nuevo gana; uno atrasado o repetido no pisa lo cargado', () => {
    expect(latestSpots(loaded, EVENT)).toEqual({ capacity: 4, occupied: 2, version: 3 });
    expect(latestSpots(loaded, { ...EVENT, version: 1 })).toEqual(loaded);
    expect(latestSpots(loaded, { ...EVENT, version: 2 })).toEqual(loaded);
  });
});
