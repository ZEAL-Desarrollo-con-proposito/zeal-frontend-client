import { describe, expect, it } from 'vitest';
import type { Workshop } from './workshop';
import {
  availabilityOf,
  bySoonest,
  hasStarted,
  isWorkshop,
  occupancy,
  spotsCount,
  startBadge,
  workshopDuration,
  workshopWhen,
} from './workshop';

const NOW = new Date(2026, 8, 23, 9, 20).getTime();

const WORKSHOP: Workshop = {
  id: 'taller-impostor',
  title: 'Síndrome del impostor en tu primer empleo',
  summary: 'Herramientas para separar lo que sientes de lo que aportas.',
  facilitator: 'Andrés Rojas',
  capacity: 30,
  occupied: 29,
  version: 4,
  startsAt: new Date(2026, 8, 24, 12, 30).toISOString(),
  endsAt: new Date(2026, 8, 24, 13, 30).toISOString(),
};

function at(hours: number, minutes: number, day = 23): string {
  return new Date(2026, 8, day, hours, minutes).toISOString();
}

describe('taller', () => {
  it('reconoce un taller del contrato y descarta lo incompleto', () => {
    expect(isWorkshop(WORKSHOP)).toBe(true);
    expect(isWorkshop({ ...WORKSHOP, capacity: 0, occupied: 0 })).toBe(false);
    expect(isWorkshop({ ...WORKSHOP, startsAt: 'pronto' })).toBe(false);
    expect(isWorkshop({ ...WORKSHOP, facilitator: undefined })).toBe(false);
    expect(isWorkshop(null)).toBe(false);
  });

  it.each([
    [12, { label: 'Con cupo', tone: 'sage', full: false }],
    [26, { label: 'Últimos cupos', tone: 'mauve', full: false }],
    [29, { label: 'Últimos cupos', tone: 'mauve', full: false }],
    [30, { label: 'Cupos agotados', tone: 'coral', full: true }],
  ])('con %i de 30 ocupados la disponibilidad es la del Figma B6', (occupied, availability) => {
    expect(availabilityOf({ capacity: 30, occupied, version: 1 })).toEqual(availability);
  });

  it('cuenta cupos y ocupación sin pasarse de la capacidad', () => {
    expect(spotsCount(WORKSHOP)).toBe('29 / 30 cupos');
    expect(occupancy(WORKSHOP)).toBe(97);
    expect(spotsCount({ capacity: 3, occupied: 5, version: 1 })).toBe('3 / 3 cupos');
    expect(occupancy({ capacity: 3, occupied: 5, version: 1 })).toBe(100);
  });

  it('dice cuándo es y cuánto dura', () => {
    expect(workshopWhen(at(16, 0), NOW)).toBe('Hoy · 16:00');
    expect(workshopWhen(WORKSHOP.startsAt, NOW)).toBe('Mañana · 12:30');
    expect(workshopWhen(at(7, 0, 28), NOW)).toBe('Lun 28 · 7:00');
    expect(workshopDuration(WORKSHOP)).toBe('60 min');
  });

  it('marca cuándo empieza pronto y cuándo ya empezó', () => {
    expect(startBadge({ startsAt: at(10, 5) }, NOW)).toEqual({
      label: 'Empieza en 45 min',
      tone: 'coral',
    });
    expect(startBadge({ startsAt: at(9, 20) }, NOW)).toEqual({ label: 'En curso', tone: 'sage' });
    expect(startBadge({ startsAt: at(10, 20) }, NOW)).toBeNull();
    expect(hasStarted({ startsAt: at(9, 20) }, NOW)).toBe(true);
    expect(hasStarted(WORKSHOP, NOW)).toBe(false);
  });

  it('ordena del más próximo al más lejano', () => {
    const later = { startsAt: at(16, 0) };
    const sooner = { startsAt: at(10, 5) };

    expect([later, sooner].sort(bySoonest)).toEqual([sooner, later]);
  });
});
