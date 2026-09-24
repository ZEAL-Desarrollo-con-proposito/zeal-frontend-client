import { describe, expect, it } from 'vitest';
import type { Slot } from './slot';
import { compareByStart, isSlot } from './slot';
import { HOUR_HEIGHT_PX, slotBox, slotsOfDay, workdaysOf } from './calendar';

function slot(id: string, start: Date, end: Date, status: Slot['status'] = 'DISPONIBLE'): Slot {
  return {
    id,
    psychologistId: 'psi-1',
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    status,
  };
}

describe('calendario semanal', () => {
  it('la semana laboral va de lunes a viernes', () => {
    const days = workdaysOf(new Date(2026, 8, 21));

    expect(days).toHaveLength(5);
    expect(days.at(-1)).toEqual(new Date(2026, 8, 25));
  });

  it('ubica una franja según su hora real dentro de la jornada', () => {
    const box = slotBox(slot('a', new Date(2026, 8, 23, 9, 0), new Date(2026, 8, 23, 9, 50)));

    expect(box.top).toBe(2 * HOUR_HEIGHT_PX);
    expect(box.height).toBeCloseTo((50 / 60) * HOUR_HEIGHT_PX);
  });

  it('recorta a la jornada visible lo que empieza antes o termina después', () => {
    const box = slotBox(slot('a', new Date(2026, 8, 23, 6, 0), new Date(2026, 8, 23, 21, 0)));

    expect(box.top).toBe(0);
    expect(box.height).toBe(12 * HOUR_HEIGHT_PX);
  });

  it('agrupa por día y ordena por hora de inicio', () => {
    const slots = [
      slot('tarde', new Date(2026, 8, 23, 15), new Date(2026, 8, 23, 16)),
      slot('otro-dia', new Date(2026, 8, 24, 8), new Date(2026, 8, 24, 9)),
      slot('manana', new Date(2026, 8, 23, 8), new Date(2026, 8, 23, 9)),
    ];

    expect(slotsOfDay(slots, new Date(2026, 8, 23)).map(({ id }) => id)).toEqual([
      'manana',
      'tarde',
    ]);
    expect([...slots].sort(compareByStart).at(0)?.id).toBe('manana');
  });
});

describe('isSlot', () => {
  const valid = slot('a', new Date(2026, 8, 23, 8), new Date(2026, 8, 23, 9), 'RESERVADA');

  it('acepta una franja con el contrato completo', () => {
    expect(isSlot(valid)).toBe(true);
  });

  it.each([
    ['sin id', { ...valid, id: '' }],
    ['sin psicólogo', { ...valid, psychologistId: 3 }],
    ['con una fecha inválida', { ...valid, startsAt: 'mañana' }],
    ['con un fin que no es texto', { ...valid, endsAt: 12 }],
    ['con un estado desconocido', { ...valid, status: 'BLOQUEADA' }],
    ['que no es objeto', 'franja'],
  ])('rechaza una franja %s', (_case, value) => {
    expect(isSlot(value)).toBe(false);
  });
});
