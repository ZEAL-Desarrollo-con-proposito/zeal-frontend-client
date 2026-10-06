import { describe, expect, it } from 'vitest';
import type { Workshop } from './workshop';
import {
  capacityLabel,
  compareByNewest,
  describeSchedule,
  hasStarted,
  isWorkshop,
} from './workshop';

const WORKSHOP: Workshop = {
  id: 'taller-pausas-activas',
  title: 'Pausas activas y respiración',
  description: 'Aprende técnicas breves de respiración y pausas activas para tu jornada.',
  startsAt: new Date(2026, 9, 6, 15).toISOString(),
  durationMinutes: 60,
  publishedAt: new Date(2026, 8, 21, 11).toISOString(),
  capacity: 30,
  occupied: 12,
  version: 1,
};

describe('contrato de talleres', () => {
  it('acepta un taller con sus cupos', () => {
    expect(isWorkshop(WORKSHOP)).toBe(true);
  });

  it.each<[string, unknown]>([
    ['un valor que no es objeto', 'taller'],
    ['sin cupos válidos', { ...WORKSHOP, capacity: -1 }],
    ['con versión fraccional', { ...WORKSHOP, version: 1.5 }],
    ['sin id de texto', { ...WORKSHOP, id: 7 }],
    ['sin título de texto', { ...WORKSHOP, title: undefined }],
    ['sin descripción de texto', { ...WORKSHOP, description: {} }],
    ['con inicio que no es fecha', { ...WORKSHOP, startsAt: 'pronto' }],
    ['con duración que no es número', { ...WORKSHOP, durationMinutes: '60' }],
    ['con duración fraccional', { ...WORKSHOP, durationMinutes: 2.5 }],
    ['con duración cero', { ...WORKSHOP, durationMinutes: 0 }],
    ['con publicación que no es fecha', { ...WORKSHOP, publishedAt: 'ayer' }],
  ])('rechaza %s', (_case, value) => {
    expect(isWorkshop(value)).toBe(false);
  });
});

describe('compareByNewest', () => {
  it('ordena por publicación reciente y, a igual instante, por id mayor', () => {
    const oldest: Workshop = { ...WORKSHOP, id: 'taller-1', publishedAt: '2026-09-01T08:00:00Z' };
    const newest: Workshop = {
      ...WORKSHOP,
      id: 'taller-2',
      publishedAt: '2026-09-02T08:00:00Z',
    };
    const tieLow: Workshop = { ...WORKSHOP, id: 'taller-9', publishedAt: '2026-09-03T08:00:00Z' };
    const tieHigh: Workshop = {
      ...WORKSHOP,
      id: 'taller-10',
      publishedAt: '2026-09-03T08:00:00Z',
    };

    const sorted = [oldest, tieLow, newest, tieHigh].sort(compareByNewest);

    expect(sorted.map(({ id }) => id)).toEqual(['taller-10', 'taller-9', 'taller-2', 'taller-1']);
  });
});

describe('hasStarted', () => {
  const now = new Date(2026, 8, 23, 9, 20).getTime();

  it('es true cuando el inicio ya pasó o coincide con el reloj', () => {
    expect(hasStarted({ startsAt: new Date(2026, 8, 23, 8).toISOString() }, now)).toBe(true);
    expect(hasStarted({ startsAt: new Date(now).toISOString() }, now)).toBe(true);
    expect(hasStarted({ startsAt: new Date(2026, 8, 23, 10).toISOString() }, now)).toBe(false);
  });
});

describe('describeSchedule', () => {
  it('describe día, inicio y fin en el horario local', () => {
    expect(
      describeSchedule({ startsAt: new Date(2026, 9, 6, 15).toISOString(), durationMinutes: 90 }),
    ).toBe('Martes, 6 de octubre · 15:00 – 16:30');
    expect(
      describeSchedule({ startsAt: new Date(2026, 9, 6, 9, 5).toISOString(), durationMinutes: 60 }),
    ).toBe('Martes, 6 de octubre · 9:05 – 10:05');
  });
});

describe('capacityLabel', () => {
  it('habla de una persona en singular y del resto en plural', () => {
    expect(capacityLabel(1)).toBe('Capacidad para 1 persona');
    expect(capacityLabel(30)).toBe('Capacidad para 30 personas');
  });
});
