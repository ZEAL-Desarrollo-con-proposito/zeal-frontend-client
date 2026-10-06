import { describe, expect, it } from 'vitest';
import { isSpotsEvent, projectTopic } from './spotsEvent';

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
