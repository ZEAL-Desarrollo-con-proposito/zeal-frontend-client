import { describe, expect, it } from 'vitest';
import type { Workshop } from './workshop';
import { isWorkshopPublishedEvent, organizationWorkshopsTopic } from './workshopEvent';

const WORKSHOP: Workshop = {
  id: 'taller-1',
  title: 'Taller de respiración',
  description: 'Una sesión práctica para respirar mejor durante la jornada.',
  startsAt: new Date(2026, 9, 6, 15).toISOString(),
  durationMinutes: 60,
  publishedAt: new Date(2026, 8, 23, 10).toISOString(),
  capacity: 25,
  occupied: 0,
  version: 1,
};

const EVENT = { type: 'PUBLICADO', workshop: WORKSHOP };

describe('canal de talleres de la organización', () => {
  it('codifica la empresa en el canal', () => {
    expect(organizationWorkshopsTopic('Nexura S.A.S.')).toBe(
      '/topic/organizaciones/Nexura%20S.A.S./talleres',
    );
    expect(organizationWorkshopsTopic('a/b')).toBe('/topic/organizaciones/a%2Fb/talleres');
  });
});

describe('isWorkshopPublishedEvent', () => {
  it('acepta el aviso de un taller recién publicado', () => {
    expect(isWorkshopPublishedEvent(EVENT)).toBe(true);
  });

  it.each<[string, unknown]>([
    ['un valor que no es objeto', 'PUBLICADO'],
    ['otro tipo de mensaje', { ...EVENT, type: 'CUPOS' }],
    ['un taller mal formado', { ...EVENT, workshop: { id: 'x' } }],
    ['sin taller', { type: 'PUBLICADO' }],
  ])('rechaza %s', (_case, value) => {
    expect(isWorkshopPublishedEvent(value)).toBe(false);
  });
});
